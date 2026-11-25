import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { AvailableModel, PublicAccount, QuotaSnapshot } from '../src/lib/types';
import {
  buildAntigravityFallbackQuotaItems,
  extractAntigravityAvailableModels,
  getAntigravityCatalog,
  getAntigravityDirectFallbackModel,
  getClaudeCatalogForPlan,
  getCodexCatalogForPlan,
  getDisplayQuotaItems,
  getModelDisplayLabel,
  groupModelsForDisplay,
  isBlacklistedAntigravityModel,
  isFreeAccount,
  isLegacyWakeupModel,
  isRetiredCodexModel,
  normalizeAntigravityWakeupModel,
  normalizeCodexWakeupModel,
  parseAnthropicModelsList,
  parseOpenAiModelsList,
  PLATFORM_WAKEUP_DEFAULTS,
  PLATFORM_WAKEUP_PRESETS,
  resolveAccountAvailableModels,
} from '../src/lib/models';
import {
  classifyAccountHealth,
  formatExactResetTime,
  getLowestRemainingPercent,
  getSoonestResetMs,
  LOW_QUOTA_THRESHOLD,
  PLATFORM_META,
  quotaTextColor,
} from '../src/lib/format';
import {
  fetchAntigravityQuota,
  wakeupAntigravity,
} from '../src/lib/providers/antigravity';
import { fetchCodexQuota, wakeupCodex } from '../src/lib/providers/codex';
import { fetchClaudeQuota, wakeupClaude } from '../src/lib/providers/claude';

function makeAccount(overrides: Partial<PublicAccount> = {}): PublicAccount {
  return {
    id: 'acc-1',
    platform: 'antigravity',
    email: 'dev@example.com',
    displayName: null,
    plan: 'FREE',
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

test('extractAntigravityAvailableModels follows agentModelSorts and filters blacklisted/internal models', () => {
  const withSorts = {
    payload: {
      agentModelSorts: [
        {
          groups: [
            {
              modelIds: [
                'gemini-4-argon-medium',
                'gemini-4-argon-high',
                'gemini-3.8-flash-tiered',
                'gemini-2.5-flash',
                'gemini-3.8-flash-high',
                'claude-sonnet-5-5-high',
                'missing-model',
                'gemini-4-argon-medium',
              ],
            },
          ],
        },
      ],
      models: {
        'gemini-4-argon-medium': {
          displayName: 'Gemini 4 Argon (Medium)',
          model: 'MODEL_PLACEHOLDER_M418',
          quotaInfo: { remainingFraction: 0.759, resetTime: '2026-11-20T05:00:00Z' },
        },
        'gemini-4-argon-high': {
          model: 'MODEL_PLACEHOLDER_M417',
          quotaInfo: { remainingFraction: 0.5 },
        },
        'gemini-3.8-flash-tiered': {
          model: 'MODEL_PLACEHOLDER_M322',
          recommended: true,
          quotaInfo: { remainingFraction: 0.9 },
        },
        'gemini-2.5-flash': {
          displayName: 'Gemini 2.5 Flash',
          recommended: true,
          quotaInfo: { remainingFraction: 0.1 },
        },
        'gemini-3.8-flash-high': {
          displayName: 'Gemini 3.8 Flash (High)',
          quotaInfo: { remainingFraction: 1 },
        },
        'claude-sonnet-5-5-high': {
          displayName: 'Claude Sonnet 5.5 (High)',
          quotaInfo: { remainingFraction: 0.42 },
        },
        'gemini-3-flash': {
          displayName: 'Gemini 3 Flash',
          recommended: true,
          quotaInfo: { remainingFraction: 0.99 },
        },
      },
    },
  };

  const sorted = extractAntigravityAvailableModels(withSorts);
  assert.deepEqual(
    sorted.map((m) => m.id),
    [
      'gemini-4-argon-medium',
      'gemini-4-argon-high',
      'gemini-3.8-flash-high',
      'claude-sonnet-5-5-high',
    ]
  );
  assert.equal(sorted[0].remainingPercent, 75);
  assert.equal(sorted[0].resetAt, '2026-11-20T05:00:00Z');
  assert.equal(sorted[1].displayName, 'Gemini 4 Argon (High)');
  assert.equal(sorted[3].family, 'claude');
  assert.ok(sorted.every((m) => m.recommended === true && m.source === 'live'));

  const withoutSorts = {
    models: {
      'gemini-3-flash': {
        displayName: 'Gemini 3 Flash',
        quotaInfo: { remainingFraction: 0.9 },
      },
      'gemini-4-hydrogen-sonar': {
        recommended: true,
        quotaInfo: { remainingFraction: 0.8 },
      },
      'gemini-3.8-flash-tiered': {
        recommended: true,
        quotaInfo: { remainingFraction: 0.8 },
      },
      'gemini-3.1-flash-lite': {
        quotaInfo: { remainingFraction: 0.7 },
      },
      'chat_20706': {
        displayName: 'chat_20706',
        recommended: true,
        quotaInfo: { remainingFraction: 0.5 },
      },
      'MODEL_PLACEHOLDER_M19': {
        recommended: true,
        quotaInfo: { remainingFraction: 0.5 },
      },
      'gemini-4-argon-high': {
        quotaInfo: { remainingFraction: 0.6 },
      },
      'gemini-future-recommended': {
        displayName: 'Gemini Future',
        recommended: true,
        quotaInfo: { remainingFraction: 0.88 },
      },
    },
  };

  const fallback = extractAntigravityAvailableModels(withoutSorts);
  assert.deepEqual(
    fallback.map((m) => m.id),
    ['gemini-4-argon-high', 'gemini-3-flash', 'gemini-future-recommended']
  );
  assert.equal(isBlacklistedAntigravityModel('MODEL_GOOGLE_GEMINI_2_5_PRO'), true);
  assert.equal(isBlacklistedAntigravityModel('MODEL_CHAT_999'), true);
  assert.equal(isBlacklistedAntigravityModel('custom-id', 'Gemini 2.5 Pro'), true);
  assert.equal(isBlacklistedAntigravityModel('custom-id', 'chat_23310'), true);
});

test('buildAntigravityFallbackQuotaItems collapses effort variants and picks lowest remaining and earliest reset', () => {
  const models: AvailableModel[] = [
    {
      id: 'gemini-3-flash',
      displayName: 'Gemini 3 Flash',
      family: 'gemini',
      remainingPercent: 90,
      resetAt: '2026-11-20T12:00:00Z',
    },
    {
      id: 'gemini-3.8-flash-medium',
      displayName: 'Gemini 3.8 Flash (Medium)',
      family: 'gemini',
      remainingPercent: 45,
      resetAt: '2026-11-20T10:00:00Z',
    },
    {
      id: 'gemini-3.8-flash-high',
      displayName: 'Gemini 3.8 Flash (High)',
      family: 'gemini',
      remainingPercent: 70,
      resetAt: '2026-11-20T08:00:00Z',
    },
    {
      id: 'gemini-4-argon-high',
      displayName: 'Gemini 4 Argon (High)',
      family: 'gemini',
      remainingPercent: null,
      resetAt: null,
    },
  ];

  const items = buildAntigravityFallbackQuotaItems(models);
  assert.deepEqual(items, [
    {
      key: 'gemini-3.8-flash',
      label: 'Gemini 3.8 Flash',
      remainingPercent: 45,
      resetAt: '2026-11-20T08:00:00Z',
    },
    {
      key: 'gemini-3-flash',
      label: 'Gemini 3 Flash',
      remainingPercent: 90,
      resetAt: '2026-11-20T12:00:00Z',
    },
  ]);
});

test('legacy FREE Antigravity DB snapshot sanitizes blacklisted/internal rows for display and models', () => {
  const legacyAccount = makeAccount({
    platform: 'antigravity',
    plan: 'FREE',
    status: 'warning',
    quota: makeQuota({
      plan: 'FREE',
      items: [
        {
          key: 'gemini-3.8-flash-high',
          label: 'Gemini 3.8 Flash (High)',
          remainingPercent: 85,
          resetAt: '2026-11-20T09:00:00Z',
        },
        { key: 'gemini-4-hydrogen-sonar', label: 'gemini-4-hydrogen-sonar', remainingPercent: 10 },
        { key: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', remainingPercent: 5 },
        { key: 'gemini-2.5-flash-thinking', label: 'Gemini 2.5 Flash (Thinking)', remainingPercent: 0 },
        {
          key: 'gemini-3-flash',
          label: 'Gemini 3 Flash',
          remainingPercent: 92,
          resetAt: '2026-11-20T11:00:00Z',
        },
        { key: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', remainingPercent: 0 },
        {
          key: 'gemini-3.8-flash-medium',
          label: 'Gemini 3.8 Flash (Medium)',
          remainingPercent: 60,
          resetAt: '2026-11-20T07:00:00Z',
        },
        { key: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', remainingPercent: 0 },
        { key: 'gemini-3.8-flash-tiered', label: 'gemini-3.8-flash-tiered', remainingPercent: 12 },
      ],
    }),
  });

  const displayItems = getDisplayQuotaItems(legacyAccount);
  assert.deepEqual(displayItems, [
    {
      key: 'gemini-3.8-flash',
      label: 'Gemini 3.8 Flash',
      remainingPercent: 60,
      resetAt: '2026-11-20T07:00:00Z',
    },
    {
      key: 'gemini-3-flash',
      label: 'Gemini 3 Flash',
      remainingPercent: 92,
      resetAt: '2026-11-20T11:00:00Z',
    },
  ]);
  assert.equal(getLowestRemainingPercent(legacyAccount), 60);
  assert.equal(classifyAccountHealth(legacyAccount), 'healthy');

  const resolved = resolveAccountAvailableModels(legacyAccount);
  assert.equal(resolved.isLive, true);
  assert.deepEqual(
    resolved.models.map((m) => m.id),
    ['gemini-3.8-flash-high', 'gemini-3.8-flash-medium', 'gemini-3-flash']
  );

  const grouped = groupModelsForDisplay(resolved.models);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].label, 'Gemini 3.8 Flash');
  assert.deepEqual(grouped[0].efforts, ['High', 'Medium']);
  assert.equal(grouped[0].remainingPercent, 60);
  assert.equal(grouped[0].resetAt, '2026-11-20T07:00:00Z');
});

test('Codex catalog respects FREE vs paid plans, retired retargeting, API Key slug preservation, and /models parsing', () => {
  const freeModels = getCodexCatalogForPlan('FREE');
  const proModels = getCodexCatalogForPlan('PRO');
  const plusModels = getCodexCatalogForPlan('PLUS');

  assert.equal(freeModels.some((m) => m.id === 'gpt-6-astra'), false);
  assert.equal(freeModels.length, 7);
  assert.equal(proModels.some((m) => m.id === 'gpt-6-astra'), true);
  assert.equal(proModels.length, 8);
  assert.equal(plusModels.length, 8);
  assert.deepEqual(
    proModels.find((m) => m.id === 'gpt-6.1-sol')?.reasoningEfforts,
    ['low', 'medium', 'high', 'xhigh', 'max', 'ultra']
  );

  assert.equal(isRetiredCodexModel('gpt-5-codex'), true);
  assert.equal(isRetiredCodexModel('gpt-5'), true);
  assert.equal(isRetiredCodexModel('gpt-5.3-codex'), true);
  assert.equal(isRetiredCodexModel('gpt-5.5'), true);
  assert.equal(isRetiredCodexModel('codex-mini-latest'), true);
  assert.equal(isRetiredCodexModel('o3-mini'), true);
  assert.equal(isRetiredCodexModel('o4-mini'), true);
  assert.equal(isRetiredCodexModel('gpt-4.1-mini'), true);
  assert.equal(isRetiredCodexModel('gpt-5.6-luna'), false);
  assert.equal(isRetiredCodexModel('gpt-6.1-sol'), false);

  assert.equal(normalizeCodexWakeupModel('gpt-5-codex', false), 'gpt-5.6-luna');
  assert.equal(normalizeCodexWakeupModel('codex-mini-latest', false), 'gpt-5.6-luna');
  assert.equal(normalizeCodexWakeupModel('gpt-6.1-sol', false), 'gpt-6.1-sol');
  assert.equal(normalizeCodexWakeupModel('', false), 'gpt-5.6-luna');
  assert.equal(normalizeCodexWakeupModel('custom-my-proxy-model', true), 'custom-my-proxy-model');
  assert.equal(normalizeCodexWakeupModel('gpt-4.1-mini', true), 'gpt-4.1-mini');
  assert.equal(normalizeCodexWakeupModel('', true), 'gpt-5.6-luna');

  const parsedOpenAi = parseOpenAiModelsList({
    data: [
      { id: 'text-embedding-3-large' },
      { id: 'tts-1-hd' },
      { id: 'whisper-1' },
      { id: 'omni-moderation-latest' },
      { id: 'dall-e-3' },
      { id: 'gpt-4o-audio-preview' },
      { id: 'gpt-4o-realtime-preview' },
      { id: 'babbage-002' },
      { id: 'davinci-002' },
      { id: 'gpt-4o' },
      { id: 'gpt-5.6-luna' },
      { id: 'GPT-5.6-LUNA' },
      { id: 'gpt-6.1-sol' },
    ],
  });
  assert.deepEqual(
    parsedOpenAi.map((m) => m.id),
    ['gpt-6.1-sol', 'gpt-5.6-luna', 'gpt-4o']
  );
  assert.equal(parsedOpenAi[0].displayName, 'GPT-6.1 Sol');
  assert.ok(parsedOpenAi.every((m) => m.source === 'live'));
});

test('Claude catalog respects FREE vs MAX 20X plans and parses Anthropic /v1/models', () => {
  const freeModels = getClaudeCatalogForPlan('FREE');
  const maxModels = getClaudeCatalogForPlan('MAX 20X');

  assert.deepEqual(
    freeModels.map((m) => m.id),
    ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001']
  );
  assert.deepEqual(
    maxModels.map((m) => m.id),
    [
      'claude-opus-4-8',
      'claude-fable-5',
      'claude-opus-4-7',
      'claude-opus-4-6',
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001',
    ]
  );

  const parsedAnthropic = parseAnthropicModelsList({
    data: [
      { id: 'claude-sonnet-4-6', display_name: 'Claude Sonnet 4.6' },
      { id: 'claude-opus-4-8', display_name: 'Claude Opus 4.8' },
      { id: 'claude-opus-4-8', display_name: 'Duplicate Opus' },
      { id: 'text-embedding-custom' },
    ],
  });
  assert.deepEqual(
    parsedAnthropic.map((m) => ({ id: m.id, displayName: m.displayName })),
    [
      { id: 'claude-opus-4-8', displayName: 'Claude Opus 4.8' },
      { id: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6' },
    ]
  );
  assert.ok(parsedAnthropic.every((m) => m.family === 'claude' && m.source === 'live'));
});

test('classifyAccountHealth, format helpers, labels, and legacy wakeup detection behave consistently', () => {
  assert.equal(LOW_QUOTA_THRESHOLD, 20);

  const at20 = makeAccount({
    quota: makeQuota({ items: [{ key: 'window:5h', label: '5h', remainingPercent: 20 }] }),
  });
  const at21 = makeAccount({
    quota: makeQuota({ items: [{ key: 'window:5h', label: '5h', remainingPercent: 21 }] }),
  });
  const forbidden = makeAccount({
    status: 'forbidden',
    quota: makeQuota({
      forbidden: true,
      items: [{ key: 'window:5h', label: '5h', remainingPercent: 95 }],
    }),
  });
  const withError = makeAccount({ status: 'active', lastError: 'Timeout' });

  assert.equal(classifyAccountHealth(at20), 'low');
  assert.equal(classifyAccountHealth(at21), 'healthy');
  assert.equal(classifyAccountHealth(forbidden), 'issue');
  assert.equal(classifyAccountHealth(withError), 'issue');

  assert.equal(
    getModelDisplayLabel('gemini-3.8-flash-high + claude-sonnet-5-5-high'),
    'Gemini 3.8 Flash (High) + Claude Sonnet 5.5 (High)'
  );
  assert.equal(getModelDisplayLabel('claude-opus-4-6', 'claude'), 'Claude Opus 4.6');
  assert.equal(getModelDisplayLabel('claude-opus-4-6', 'antigravity'), 'Claude Opus 4.6 (Thinking)');
  assert.equal(getModelDisplayLabel('unknown-custom-slug'), null);

  assert.equal(normalizeAntigravityWakeupModel('gemini-4-hydrogen'), 'gemini-4-hydrogen-high');
  assert.equal(normalizeAntigravityWakeupModel('gemini-3.8-flash'), 'gemini-3.8-flash-high');
  assert.equal(normalizeAntigravityWakeupModel('gemini-4-argon'), 'gemini-4-argon-high');
  assert.equal(normalizeAntigravityWakeupModel('claude-sonnet-5-5'), 'claude-sonnet-5-5-high');
  assert.equal(normalizeAntigravityWakeupModel('claude-opus-5-5'), 'claude-opus-5-5-high');
  assert.equal(normalizeAntigravityWakeupModel('claude-sonnet-4-5'), 'claude-sonnet-4-6');
  assert.equal(normalizeAntigravityWakeupModel('claude-sonnet-4-5-thinking'), 'claude-sonnet-4-6');
  assert.equal(normalizeAntigravityWakeupModel('claude-opus-4-5-thinking'), 'claude-opus-4-6-thinking');
  assert.equal(getAntigravityDirectFallbackModel('claude-sonnet-5-5-high'), 'claude-sonnet-4-6');
  assert.equal(getAntigravityDirectFallbackModel('gemini-3.8-flash-high'), 'gemini-3-flash');
  assert.equal(getModelDisplayLabel('gemini-4-hydrogen-high'), 'Gemini 4 Hydrogen (High)');

  assert.equal(isLegacyWakeupModel('codex', 'gpt-5-codex'), true);
  assert.equal(isLegacyWakeupModel('codex', 'gpt-5.6-luna'), false);
  assert.equal(isLegacyWakeupModel('antigravity', 'gemini-2.5-pro'), true);
  assert.equal(isLegacyWakeupModel('antigravity', 'gemini-3.8-flash'), true);
  assert.equal(isLegacyWakeupModel('antigravity', 'gemini-3.8-flash-high'), false);
  assert.equal(isLegacyWakeupModel('antigravity', 'gemini-4-hydrogen-high'), false);
  assert.equal(isLegacyWakeupModel('claude', 'claude-sonnet-4-20250514'), true);
  assert.equal(isLegacyWakeupModel('claude', 'claude-sonnet-4-5'), true);
  assert.equal(isLegacyWakeupModel('claude', 'claude-sonnet-4-6'), false);

  assert.equal(PLATFORM_WAKEUP_DEFAULTS.antigravity, 'gemini-4-hydrogen-high');
  assert.equal(PLATFORM_META.antigravity.defaultWakeupModel, PLATFORM_WAKEUP_DEFAULTS.antigravity);
  assert.deepEqual(PLATFORM_META.codex.wakeupModels, PLATFORM_WAKEUP_PRESETS.codex);
  assert.equal(getAntigravityCatalog().length, 21);
  assert.ok(getAntigravityCatalog().some((m) => m.id === 'gemini-4-hydrogen-high'));

  const resetAcc = makeAccount({
    platform: 'codex',
    quota: makeQuota({
      items: [
        { key: 'window:7d', label: '7d', remainingPercent: 80, resetAt: '2026-11-22T00:00:00Z' },
        { key: 'window:5h', label: '5h', remainingPercent: 50, resetAt: '2026-11-19T15:00:00Z' },
      ],
    }),
  });
  assert.equal(getSoonestResetMs(resetAcc), Date.parse('2026-11-19T15:00:00Z'));
  assert.notEqual(formatExactResetTime('2026-11-19T15:00:00Z'), '');
  assert.equal(formatExactResetTime(null), '');
  assert.equal(quotaTextColor(10), 'text-[#f87171]');
  assert.equal(quotaTextColor(30), 'text-[#fbbf24]');
  assert.equal(quotaTextColor(80), 'text-[#34d399]');
});

test('providers integrate model extraction, bucket sorting, and wakeup fallback/normalization', async () => {
  const originalFetch = globalThis.fetch;
  try {
    // 1) Antigravity: summary bucket sorting + 404 direct fallback on wakeup
    const agStreamModels: string[] = [];
    globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes(':loadCodeAssist')) {
        return new Response(
          JSON.stringify({ paidTier: { id: 'pro-tier' }, cloudaicompanionProject: 'proj-1' }),
          { status: 200 }
        );
      }
      if (url.includes(':fetchAvailableModels')) {
        return new Response(
          JSON.stringify({
            agentModelSorts: [{ groups: [{ modelIds: ['gemini-3.8-flash-high', 'gemini-3-flash'] }] }],
            models: {
              'gemini-3.8-flash-high': {
                displayName: 'Gemini 3.8 Flash (High)',
                quotaInfo: { remainingFraction: 0.8 },
              },
              'gemini-3-flash': {
                displayName: 'Gemini 3 Flash',
                quotaInfo: { remainingFraction: 0.9 },
              },
            },
          }),
          { status: 200 }
        );
      }
      if (url.includes(':retrieveUserQuotaSummary')) {
        return new Response(
          JSON.stringify({
            groups: [
              {
                buckets: [
                  { bucketId: 'argon-weekly', remainingFraction: 0.7 },
                  { bucketId: '3p-5h', remainingFraction: 0.5 },
                  { bucketId: 'gemini-5h', remainingFraction: 0.9 },
                ],
              },
            ],
          }),
          { status: 200 }
        );
      }
      if (url.includes(':streamGenerateContent')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as { model?: string };
        agStreamModels.push(body.model ?? '');
        if (body.model === 'gemini-3.8-flash-high') {
          return new Response('model not found', { status: 404 });
        }
        return new Response(
          'data: {"candidates":[{"content":{"parts":[{"text":"hi"}]}}]}\n\n',
          { status: 200 }
        );
      }
      throw new Error(`Unexpected Antigravity URL: ${url}`);
    }) as typeof fetch;

    const agCreds = {
      authType: 'oauth' as const,
      accessToken: 'ag-token',
      expiresAt: Math.floor(Date.now() / 1000) + 7200,
    };
    const agQuota = await fetchAntigravityQuota(agCreds);
    assert.deepEqual(
      agQuota.quota.items.map((i) => i.key),
      ['bucket:gemini-5h', 'bucket:3p-5h', 'bucket:argon-weekly']
    );
    assert.equal(agQuota.quota.availableModels?.length, 2);

    const agWake = await wakeupAntigravity(agCreds, 'gemini-3.8-flash');
    assert.deepEqual(agStreamModels, ['gemini-3.8-flash-high', 'gemini-3-flash']);
    assert.match(agWake.message, /gemini-3\.8-flash-high -> gemini-3-flash/);

    // Antigravity must NOT retry fallback on 429
    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input);
      if (url.includes(':loadCodeAssist')) {
        return new Response(JSON.stringify({ currentTier: { id: 'free-tier' } }), { status: 200 });
      }
      if (url.includes(':streamGenerateContent')) {
        return new Response('rate limited', { status: 429 });
      }
      throw new Error(`Unexpected Antigravity URL: ${url}`);
    }) as typeof fetch;
    await assert.rejects(() => wakeupAntigravity(agCreds, 'gemini-3.8-flash-high'), /HTTP 429/);

    // 2) Codex: API key /models parsing + OAuth retired wakeup retargeting
    const codexBodies: Array<{ url: string; model?: string }> = [];
    globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/models')) {
        return new Response(
          JSON.stringify({
            data: [{ id: 'gpt-6.1-sol' }, { id: 'text-embedding-3-small' }, { id: 'gpt-4o' }],
          }),
          { status: 200 }
        );
      }
      if (url.includes('/responses')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as { model?: string };
        codexBodies.push({ url, model: body.model });
        return new Response('data: {}\n', { status: 200 });
      }
      if (url.includes('wham/usage')) {
        return new Response(
          JSON.stringify({
            plan_type: 'free',
            rate_limit: { primary_window: { used_percent: 10 }, secondary_window: { used_percent: 5 } },
          }),
          { status: 200 }
        );
      }
      throw new Error(`Unexpected Codex URL: ${url}`);
    }) as typeof fetch;

    const codexApiQuota = await fetchCodexQuota({ authType: 'api_key', apiKey: 'sk-test' });
    assert.equal(codexApiQuota.quota.availableModels?.length, 2);
    assert.match(codexApiQuota.quota.items[0].detail ?? '', /2 โมเดล/);

    const codexOAuthWake = await wakeupCodex(
      {
        authType: 'oauth',
        accessToken: 'cx-token',
        expiresAt: Math.floor(Date.now() / 1000) + 7200,
      },
      'gpt-5-codex'
    );
    assert.equal(codexOAuthWake.model, 'gpt-5.6-luna');
    assert.equal(codexBodies[0].model, 'gpt-5.6-luna');
    assert.equal(codexOAuthWake.quota.availableModels?.some((m) => m.id === 'gpt-6-astra'), false);

    // 3) Claude: seven_day_opus + OAuth /v1/models fallback + wakeup alias normalization
    let claudeSentModel = '';
    globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/oauth/usage')) {
        return new Response(
          JSON.stringify({
            five_hour: { utilization: 12 },
            seven_day: { utilization: 34 },
            seven_day_opus: { utilization: 40, resets_at: '2026-11-25T00:00:00Z' },
          }),
          { status: 200 }
        );
      }
      if (url.includes('/api/oauth/profile')) {
        return new Response(
          JSON.stringify({ organization: { rate_limit_tier: 'claude_max_20x' } }),
          { status: 200 }
        );
      }
      if (url.endsWith('/v1/models')) {
        return new Response('unavailable', { status: 500 });
      }
      if (url.includes('/v1/messages')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as { model?: string };
        claudeSentModel = body.model ?? '';
        return new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 });
      }
      throw new Error(`Unexpected Claude URL: ${url}`);
    }) as typeof fetch;

    const claudeWake = await wakeupClaude(
      {
        authType: 'oauth',
        accessToken: 'cl-token',
        expiresAt: Math.floor(Date.now() / 1000) + 7200,
      },
      'claude-haiku-4-5'
    );
    assert.equal(claudeSentModel, 'claude-haiku-4-5-20251001');
    assert.equal(claudeWake.model, 'claude-haiku-4-5-20251001');
    assert.equal(
      claudeWake.quota.items.find((i) => i.key === 'window:7d_opus')?.remainingPercent,
      60
    );
    assert.equal(claudeWake.quota.availableModels?.length, 6);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('resolveAccountAvailableModels filters exhausted/forbidden models and isFreeAccount detects FREE tier', () => {
  const exhaustedAndUsable = makeAccount({
    platform: 'antigravity',
    plan: 'PRO',
    quota: makeQuota({
      plan: 'PRO',
      availableModels: [
        {
          id: 'gemini-4-hydrogen-high',
          displayName: 'Gemini 4 Hydrogen (High)',
          family: 'gemini',
          remainingPercent: 80,
          source: 'live',
        },
        {
          id: 'gemini-4-argon-high',
          displayName: 'Gemini 4 Argon (High)',
          family: 'gemini',
          remainingPercent: 0,
          source: 'live',
        },
      ],
    }),
  });
  assert.deepEqual(
    resolveAccountAvailableModels(exhaustedAndUsable).models.map((m) => m.id),
    ['gemini-4-hydrogen-high']
  );

  const allExhausted = makeAccount({
    platform: 'antigravity',
    plan: 'PRO',
    quota: makeQuota({
      plan: 'PRO',
      availableModels: [
        {
          id: 'gemini-4-hydrogen-high',
          displayName: 'Gemini 4 Hydrogen (High)',
          family: 'gemini',
          remainingPercent: 0,
          source: 'live',
        },
      ],
    }),
  });
  assert.equal(resolveAccountAvailableModels(allExhausted).models.length, 0);
  assert.equal(resolveAccountAvailableModels(allExhausted).isLive, true);

  const forbiddenAcc = makeAccount({
    platform: 'antigravity',
    status: 'forbidden',
    plan: 'PRO',
    quota: makeQuota({ forbidden: true }),
  });
  assert.equal(resolveAccountAvailableModels(forbiddenAcc).models.length, 0);

  const claudeOpusExhausted = makeAccount({
    platform: 'claude',
    plan: 'MAX 20X',
    quota: makeQuota({
      plan: 'MAX 20X',
      items: [
        { key: 'window:5h', label: '5h', remainingPercent: 80 },
        { key: 'window:7d', label: '7d', remainingPercent: 60 },
        { key: 'window:7d_opus', label: '7d Opus', remainingPercent: 0 },
      ],
    }),
  });
  const claudeModels = resolveAccountAvailableModels(claudeOpusExhausted).models.map((m) => m.id);
  assert.equal(claudeModels.some((id) => id.includes('opus')), false);
  assert.equal(claudeModels.includes('claude-sonnet-4-6'), true);

  assert.equal(isFreeAccount(makeAccount({ plan: 'FREE' })), true);
  assert.equal(isFreeAccount(makeAccount({ plan: null, quota: makeQuota({ plan: 'free-tier' }) })), true);
  assert.equal(isFreeAccount(makeAccount({ plan: 'PRO' })), false);
});
