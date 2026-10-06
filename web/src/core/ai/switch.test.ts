// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createToken, loadConfig, updateConfig } from '@/core/localapi/config';
import { createDeviceKeyStore } from '@/core/secrets/deviceKey';
import { getSettings } from '@/core/settings/settings';
import {
  addProvider,
  defaultAiConfig,
  entryFromPreset,
  keyName,
  loadAiConfig,
  saveAiConfig,
  setProviderKey,
} from './config';
import {
  aiSwitchSchema,
  AI_SWITCH_SCOPE,
  isAiOn,
  purgeAi,
  switchAiOff,
  switchAiOn,
} from './switch';

const secrets = () => createDeviceKeyStore(db);

beforeEach(async () => {
  localStorage.clear();
  await switchAiOn();
  for (const t of ['_secrets', '_aiCache', '_aiUsage']) await db.table(t).clear();
});

async function configured() {
  let config = addProvider(defaultAiConfig(), entryFromPreset('anthropic'));
  await saveAiConfig(config, db);
  config = await setProviderKey(config, 'anthropic', 'sk-test-not-real', db, secrets());
  await db.table('_aiCache').put({ key: 'k', intent: {}, createdAt: 1 });
  await db.table('_aiUsage').add({ at: 1, stage: 'cloud', providerId: 'anthropic' });
  return config;
}

describe('AI master switch', () => {
  it('is on by default', async () => {
    expect(await isAiOn()).toBe(true);
  });

  it('purge deletes keys, provider list, cache, statistics and revokes the API tokens', async () => {
    await configured();
    await updateConfig({ enabled: true }, db);
    await createToken({ name: 'Claude', expiresInDays: null, grants: {}, autoCommit: false }, db);
    expect((await loadConfig(db)).tokens).toHaveLength(1);
    expect(await secrets().get(keyName('anthropic'))).toBe('sk-test-not-real');

    await purgeAi(db, secrets());

    expect(await secrets().get(keyName('anthropic'))).toBeUndefined();
    expect((await loadAiConfig(db, secrets())).providers).toEqual([]);
    expect(await db.table('_aiCache').count()).toBe(0);
    expect(await db.table('_aiUsage').count()).toBe(0);
    const api = await loadConfig(db);
    expect(api.enabled).toBe(false);
    expect(api.tokens).toEqual([]);
  });

  it('"this device" sets the local flag only; "all devices" also the synced setting', async () => {
    await switchAiOff('device');
    expect(localStorage.getItem('tm-ai-off')).toBe('1');
    expect(await isAiOn()).toBe(false);
    expect((await getSettings(AI_SWITCH_SCOPE, aiSwitchSchema, {})).off).toBe(false);
    await switchAiOn();
    expect(await isAiOn()).toBe(true);

    await switchAiOff('all');
    expect(localStorage.getItem('tm-ai-off')).toBeNull();
    expect((await getSettings(AI_SWITCH_SCOPE, aiSwitchSchema, {})).off).toBe(true);
    expect(await isAiOn()).toBe(false);
    await switchAiOn();
    expect(await isAiOn()).toBe(true);
  });
});
