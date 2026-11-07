import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.APP_SECRET = 'test-secret-key-at-least-32-characters-long-12345';
process.env.ADMIN_PASSWORD = 'my-secret-password';

import { encryptJson, decryptJson } from '../src/lib/crypto';
import {
  createSessionToken,
  verifyAdminPassword,
  verifySessionToken,
} from '../src/lib/auth';
import { parseAntigravityCallback } from '../src/lib/providers/antigravity';
import { parseCodexCallback } from '../src/lib/providers/codex';
import { parseClaudeCallback } from '../src/lib/providers/claude';
import { parseCockpitImportPayload } from '../src/lib/importParser';

test('encryptJson / decryptJson roundtrip and tamper rejection', () => {
  const secret = { refreshToken: '1//0gTestToken', projectId: 'my-proj' };
  const enc = encryptJson(secret);
  assert.ok(enc.startsWith('v1.'));
  assert.ok(!enc.includes('1//0gTestToken'));

  const dec = decryptJson<typeof secret>(enc);
  assert.deepEqual(dec, secret);

  assert.throws(() => decryptJson(`${enc}tampered`));
});

test('auth password check and session token verification', async () => {
  assert.equal(await verifyAdminPassword('my-secret-password'), true);
  assert.equal(await verifyAdminPassword('wrong-password'), false);

  const token = await createSessionToken();
  assert.equal(await verifySessionToken(token), true);
  assert.equal(await verifySessionToken(`${token}x`), false);
});

test('OAuth callback parsers handle full URLs and code#state', () => {
  const ag = parseAntigravityCallback(
    'http://localhost:54123/oauth-callback?state=abc-123&code=4/0AeanS0xyz&scope=openid'
  );
  assert.equal(ag.code, '4/0AeanS0xyz');
  assert.equal(ag.state, 'abc-123');

  const cx = parseCodexCallback(
    'http://localhost:1455/auth/callback?code=codex_code_99&state=st_1'
  );
  assert.equal(cx.code, 'codex_code_99');
  assert.equal(cx.state, 'st_1');

  const cl = parseClaudeCallback('ant_auth_code_777#state_xyz');
  assert.equal(cl.code, 'ant_auth_code_777');
  assert.equal(cl.state, 'state_xyz');
});

test('parseCockpitImportPayload parses Cockpit backups, auth.json and .credentials.json with deduplication', () => {
  const backupJson = JSON.stringify({
    schema: 'cockpit-tools.account-transfer',
    version: 1,
    platforms: {
      antigravity: {
        exported_data: [
          { email: 'dev@gmail.com', refresh_token: '1//0gDuplicateCheck', tags: ['pro'] },
        ],
      },
      antigravity_ide: {
        exported_data: [
          { email: 'dev@gmail.com', refresh_token: '1//0gDuplicateCheck', tags: ['pro'] },
        ],
      },
      codex: {
        exported_data: [
          {
            email: 'codex@openai.com',
            account_id: 'acct_123',
            tokens: { refresh_token: 'rt_codex_123', access_token: 'eyJ_acc' },
          },
        ],
      },
      claude: {
        exported_data: [
          {
            email: 'claude@anthropic.com',
            claude_credentials_raw: {
              claudeAiOauth: {
                accessToken: 'sk-ant-oat01-aaa',
                refreshToken: 'sk-ant-ort01-bbb',
              },
            },
          },
        ],
      },
    },
  });

  const parsed = parseCockpitImportPayload(backupJson);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].platform, 'antigravity');
  assert.equal(parsed[1].platform, 'codex');
  assert.equal(parsed[2].platform, 'claude');

  const delimited = parseCockpitImportPayload(
    'user@gmail.com----pass----aux@gmail.com----2FA----1//0gLineToken'
  );
  assert.equal(delimited.length, 1);
  assert.equal(delimited[0].platform, 'antigravity');
  assert.equal(delimited[0].email, 'user@gmail.com');
  assert.equal(delimited[0].credentials.refreshToken, '1//0gLineToken');
});
