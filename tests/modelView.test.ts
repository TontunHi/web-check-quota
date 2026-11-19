import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { PublicAccount, QuotaSnapshot } from '../src/lib/types';
import {
  accountMatchesModelFilter,
  buildCatalogGroups,
  collectAccountModelFilterOptions,
  countUniqueAccountModels,
  getAccountFamilyRemainingPercent,
  getEffortChipLabel,
  sortAccounts,
} from '../src/components/modelViewHelpers';

function makeAccount(overrides: Partial<PublicAccount> = {}): PublicAccount {
  return {
    id: 'acc-1',
    platform: 'antigravity',
    email: 'dev@example.com',
    displayName: null,
    plan: 'PRO',
    groupName: null,
    tags: [],
    note: null,
    wakeupEnabled: true,
    wakeupModel: null,
    status: 'active',
    lastError: null,
    quota: null,
    lastRefreshedAt: null,
    lastWakeupAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeQuota(overrides: Partial<QuotaSnapshot> = {}): QuotaSnapshot {
  return {
    items: [],
    fetchedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('buildCatalogGroups aggregates connected accounts and full v1.3.80 catalog accurately', () => {
  const ag1 = makeAccount({
    id: 'ag-1',
    platform: 'antigravity',
    email: 'ag1@example.com',
    quota: makeQuota({
      availableModels: [
        {
          id: 'gemini-4-argon-high',
          displayName: 'Gemini 4 Argon (High)',
          family: 'gemini',
          remainingPercent: 70,
          source: 'live',
        },
        {
          id: 'gemini-4-argon-medium',
          displayName: 'Gemini 4 Argon (Medium)',
          family: 'gemini',
          remainingPercent: 50,
          source: 'live',
        },
      ],
    }),
  });

  const ag2 = makeAccount({
    id: 'ag-2',
    platform: 'antigravity',
    email: 'ag2@example.com',
    quota: makeQuota({
      availableModels: [
        {
          id: 'gemini-4-argon-high',
          displayName: 'Gemini 4 Argon (High)',
          family: 'gemini',
          remainingPercent: 90,
          source: 'live',
        },
      ],
    }),
  });

  const cxFree = makeAccount({
    id: 'cx-1',
    platform: 'codex',
    email: 'cx@example.com',
    plan: 'FREE',
    quota: makeQuota({
      plan: 'FREE',
      items: [
        { key: 'window:5h', label: '5h', remainingPercent: 80 },
        { key: 'window:7d', label: '7d', remainingPercent: 45 },
      ],
    }),
  });

  const clMax = makeAccount({
    id: 'cl-1',
    platform: 'claude',
    email: 'cl@example.com',
    plan: 'MAX 20X',
    quota: makeQuota({
      plan: 'MAX 20X',
      items: [
        { key: 'window:5h', label: '5h', remainingPercent: 90 },
        { key: 'window:7d', label: '7d', remainingPercent: 75 },
        { key: 'window:7d_opus', label: '7d Opus', remainingPercent: 30 },
      ],
    }),
  });

  const accounts = [ag1, ag2, cxFree, clMax];
  const accountScoped = buildCatalogGroups(accounts, 'accounts');

  assert.equal(accountScoped.antigravity.length, 1);
  assert.equal(accountScoped.antigravity[0].group.models.length, 2);
  assert.equal(accountScoped.antigravity[0].accountCount, 2);
  assert.equal(accountScoped.antigravity[0].bestRemainingPercent, 90);
  assert.equal(accountScoped.antigravity[0].primaryModelId, 'gemini-4-argon-high');
  assert.equal(accountScoped.antigravity[0].group.isLive, true);

  // Free Codex excludes gpt-6-astra
  assert.equal(
    accountScoped.codex.some((e) => e.primaryModelId === 'gpt-6-astra'),
    false
  );
  assert.equal(accountScoped.codex[0].bestRemainingPercent, 45);

  const opusEntry = accountScoped.claude.find(
    (e) => e.primaryModelId === 'claude-opus-4-8'
  );
  const sonnetEntry = accountScoped.claude.find(
    (e) => e.primaryModelId === 'claude-sonnet-4-6'
  );
  assert.equal(opusEntry?.bestRemainingPercent, 30);
  assert.equal(sonnetEntry?.bestRemainingPercent, 75);

  // Full catalog includes paid-only models like gpt-6-astra even with 0 supporting accounts
  const fullCatalog = buildCatalogGroups(accounts, 'catalog');
  const astraCatalog = fullCatalog.codex.find(
    (e) => e.primaryModelId === 'gpt-6-astra'
  );
  assert.ok(astraCatalog);
  assert.equal(astraCatalog.accountCount, 0);
  assert.equal(astraCatalog.bestRemainingPercent, null);

  assert.equal(countUniqueAccountModels(accounts), 2 + 7 + 6);
});

test('getAccountFamilyRemainingPercent skips forbidden accounts and synthetic apikey status', () => {
  const forbidden = makeAccount({
    platform: 'codex',
    status: 'forbidden',
    quota: makeQuota({
      forbidden: true,
      items: [{ key: 'window:5h', label: '5h', remainingPercent: 80 }],
    }),
  });
  assert.equal(
    getAccountFamilyRemainingPercent(forbidden, {
      groupKey: 'gpt-6.1-sol',
      label: 'GPT-6.1 Sol',
      family: 'openai',
      models: [],
      efforts: [],
      remainingPercent: null,
      resetAt: null,
      isLive: false,
    }),
    null
  );

  const apiKey = makeAccount({
    platform: 'codex',
    plan: 'API KEY',
    quota: makeQuota({
      items: [{ key: 'apikey:status', label: 'API Key', remainingPercent: 100 }],
    }),
  });
  assert.equal(
    getAccountFamilyRemainingPercent(apiKey, {
      groupKey: 'gpt-6.1-sol',
      label: 'GPT-6.1 Sol',
      family: 'openai',
      models: [],
      efforts: [],
      remainingPercent: null,
      resetAt: null,
      isLive: false,
    }),
    null
  );
});

test('accountMatchesModelFilter and collectAccountModelFilterOptions match canonical groups', () => {
  const agMediumOnly = makeAccount({
    id: 'ag-med',
    platform: 'antigravity',
    quota: makeQuota({
      availableModels: [
        {
          id: 'gemini-4-argon-medium',
          displayName: 'Gemini 4 Argon (Medium)',
          family: 'gemini',
          source: 'live',
        },
      ],
    }),
  });

  // Filtering by gemini-4-argon-high matches account with gemini-4-argon-medium via canonical groupKey
  assert.equal(accountMatchesModelFilter(agMediumOnly, 'gemini-4-argon-high'), true);
  assert.equal(accountMatchesModelFilter(agMediumOnly, 'claude-opus-4-8'), false);

  const options = collectAccountModelFilterOptions(
    [agMediumOnly],
    'antigravity',
    'gemini-4-argon-high'
  );
  assert.equal(options.length, 1);
  assert.equal(options[0].value, 'gemini-4-argon-high');
  assert.equal(options[0].label, 'Gemini 4 Argon');

  // Unmatched active filter from catalog still preserves an option
  const withMissing = collectAccountModelFilterOptions(
    [agMediumOnly],
    'codex',
    'gpt-6-astra'
  );
  assert.equal(withMissing[0].value, 'gpt-6-astra');
  assert.equal(withMissing[0].label, 'GPT-6 Astra');
});

test('sortAccounts and getEffortChipLabel handle lowest_quota, soonest_reset, and name', () => {
  const a = makeAccount({
    id: 'a',
    email: 'zeta@example.com',
    quota: makeQuota({
      items: [{ key: 'window:5h', label: '5h', remainingPercent: 60, resetAt: '2026-11-20T10:00:00Z' }],
    }),
  });
  const b = makeAccount({
    id: 'b',
    email: 'alpha@example.com',
    quota: makeQuota({
      items: [{ key: 'window:5h', label: '5h', remainingPercent: 15, resetAt: '2026-11-20T12:00:00Z' }],
    }),
  });
  const c = makeAccount({
    id: 'c',
    email: 'beta@example.com',
    quota: null,
  });

  assert.deepEqual(
    sortAccounts([a, b, c], 'lowest_quota').map((x) => x.id),
    ['b', 'a', 'c']
  );
  assert.deepEqual(
    sortAccounts([a, b, c], 'soonest_reset').map((x) => x.id),
    ['a', 'b', 'c']
  );
  assert.deepEqual(
    sortAccounts([a, b, c], 'name').map((x) => x.id),
    ['b', 'c', 'a']
  );

  assert.equal(
    getEffortChipLabel({
      id: 'gemini-4-argon-high',
      displayName: 'Gemini 4 Argon (High)',
      family: 'gemini',
    }),
    'High'
  );
});
