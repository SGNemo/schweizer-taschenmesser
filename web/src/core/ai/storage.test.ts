import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import {
  cacheKey,
  clearAiCache,
  getCachedIntent,
  normalizeQuestion,
  putCachedIntent,
} from './cache';
import { createDeviceKeyStore } from '@/core/secrets/deviceKey';
import {
  addProvider,
  createRouterProvider,
  defaultAiConfig,
  entryFromPreset,
  isAiConfigured,
  keyName,
  loadAiConfig,
  moveProvider,
  removeProvider,
  saveAiConfig,
  setProviderKey,
} from './config';
import { estimateCostUsd, loadUsageTotals, recordUsage, resetUsage, totalsOf } from './usage';

beforeEach(async () => {
  await db.table('_secrets').clear();
  await db.table('_aiCache').clear();
  await db.table('_aiUsage').clear();
});
afterEach(() => setNow());

describe('config', () => {
  const secrets = () => createDeviceKeyStore(db);

  it('starts empty and persists the provider list locally', async () => {
    expect(await loadAiConfig(db, secrets())).toEqual(defaultAiConfig());
    await saveAiConfig(addProvider(defaultAiConfig(), entryFromPreset('openrouter')), db);
    expect((await loadAiConfig(db, secrets())).providers.map((p) => p.id)).toEqual(['openrouter']);
  });

  it('orders new providers local → free → paid and can reorder them', () => {
    let config = defaultAiConfig();
    for (const id of ['anthropic', 'groq', 'ollama', 'openrouter', 'openai'] as const) {
      config = addProvider(config, entryFromPreset(id, config.providers));
    }
    expect(config.providers.map((p) => p.id)).toEqual([
      'ollama',
      'groq',
      'openrouter',
      'anthropic',
      'openai',
    ]);
    config = moveProvider(config, 'openai', -1);
    expect(config.providers.map((p) => p.id).slice(-2)).toEqual(['openai', 'anthropic']);
    expect(moveProvider(config, 'ollama', -1)).toBe(config); // already first
  });

  it('gives a second provider of the same kind its own id', () => {
    const first = entryFromPreset('custom');
    const second = entryFromPreset('custom', [first]);
    expect([first.id, second.id]).toEqual(['custom', 'custom-2']);
  });

  it('keeps API keys out of the config, encrypted at rest, and never in a synced table', async () => {
    let config = addProvider(defaultAiConfig(), entryFromPreset('anthropic'));
    config = await setProviderKey(config, 'anthropic', 'sk-ant-secret', db, secrets());
    expect(config.providers[0]!.keySet).toBe(true);
    expect(await secrets().get(keyName('anthropic'))).toBe('sk-ant-secret');

    const rows = JSON.stringify(await db.table('_secrets').toArray());
    expect(rows).not.toContain('sk-ant-secret');
    expect(rows).toContain('v1.'); // ciphertext
    expect(await db.table('_settings').count()).toBe(0);
    expect(await db.table('_outbox').count()).toBe(0);

    config = await setProviderKey(config, 'anthropic', '', db, secrets());
    expect(config.providers[0]!.keySet).toBe(false);
    expect(await secrets().get(keyName('anthropic'))).toBeUndefined();
  });

  it('migrates the old single-provider config: the clear-text key moves into the secret store', async () => {
    await db.table('_secrets').put({
      key: 'aiConfig',
      value: {
        provider: 'claude',
        anthropicKey: 'sk-ant-legacy',
        claudeModel: 'claude-sonnet-5-5',
        ollamaUrl: 'http://localhost:11434',
        ollamaModel: 'qwen2.5:7b',
      },
    });
    const config = await loadAiConfig(db, secrets());
    expect(config.providers).toHaveLength(1);
    expect(config.providers[0]).toMatchObject({
      id: 'anthropic',
      enabled: true,
      model: 'claude-sonnet-5-5',
      keySet: true,
    });
    expect(await secrets().get(keyName('anthropic'))).toBe('sk-ant-legacy');
    expect(JSON.stringify(await db.table('_secrets').toArray())).not.toContain('sk-ant-legacy');
    // migrated once: the row now has the new shape
    expect((await db.table('_secrets').get('aiConfig')).value.v).toBe(2);
  });

  it('migrates a legacy "off" config to an empty list and a legacy Ollama choice to a local provider', async () => {
    await db.table('_secrets').put({ key: 'aiConfig', value: { provider: 'off' } });
    expect((await loadAiConfig(db, secrets())).providers).toEqual([]);
    await db.table('_secrets').put({
      key: 'aiConfig',
      value: { provider: 'ollama', ollamaUrl: 'http://nas:11434', ollamaModel: 'llama3.1' },
    });
    expect((await loadAiConfig(db, secrets())).providers[0]).toMatchObject({
      preset: 'ollama',
      baseUrl: 'http://nas:11434',
      model: 'llama3.1',
      tier: 'local',
      enabled: true,
    });
  });

  it('is "configured" only with a usable, enabled provider', async () => {
    const empty = defaultAiConfig();
    expect(isAiConfigured(empty)).toBe(false);
    const claude = entryFromPreset('anthropic');
    expect(isAiConfigured({ ...empty, providers: [claude] })).toBe(false); // no key yet
    expect(isAiConfigured({ ...empty, providers: [{ ...claude, keySet: true }] })).toBe(true);
    expect(
      isAiConfigured({ ...empty, providers: [{ ...claude, keySet: true, enabled: false }] }),
    ).toBe(false);
    expect(isAiConfigured({ ...empty, providers: [entryFromPreset('ollama')] })).toBe(true); // keyless
    expect(
      isAiConfigured({ ...empty, providers: [{ ...entryFromPreset('ollama'), model: '' }] }),
    ).toBe(false);
  });

  it('builds a router only from usable providers with a stored key', async () => {
    const store = secrets();
    let config = defaultAiConfig();
    config = addProvider(config, entryFromPreset('ollama', config.providers));
    config = addProvider(config, entryFromPreset('groq', config.providers));
    config = addProvider(config, entryFromPreset('anthropic', config.providers));
    config = await setProviderKey(config, 'groq', 'gsk-1', db, store);
    // anthropic has no key -> skipped
    const router = await createRouterProvider(config, { secrets: store, database: db });
    expect(router).toMatchObject({ id: 'router', model: 'qwen2.5:7b' });

    expect(await createRouterProvider(defaultAiConfig(), { secrets: store })).toBeUndefined();
    const noKey = { ...config, providers: config.providers.filter((p) => p.id === 'anthropic') };
    expect(await createRouterProvider(noKey, { secrets: store })).toBeUndefined();

    // a flag that says "key stored" but a store that lost it is skipped, not failed on every call
    const lost = await removeProvider(config, 'anthropic', db, store);
    const flagged = { ...lost, providers: [{ ...entryFromPreset('anthropic'), keySet: true }] };
    expect(await createRouterProvider(flagged, { secrets: store })).toBeUndefined();
  });
});

describe('cache', () => {
  const parts = {
    question: 'Was kostet Netflix?',
    today: '2026-09-29',
    schemaHash: 'abc',
  };

  it('normalizes questions', () => {
    expect(normalizeQuestion('  Was kostet   NETFLIX?! ')).toBe('was kostet netflix');
    expect(normalizeQuestion('Übersicht')).toBe('ubersicht');
  });

  it('keys depend on question, date and schema – not on the provider that answered', async () => {
    const base = await cacheKey(parts);
    expect(await cacheKey({ ...parts, question: ' was kostet netflix ' })).toBe(base);
    expect(await cacheKey({ ...parts, today: '2026-09-30' })).not.toBe(base);
    expect(await cacheKey({ ...parts, schemaHash: 'def' })).not.toBe(base);
    expect(base).toMatch(/^[0-9a-f]{64}$/);
  });

  it('stores validated intents and expires them', async () => {
    setNow(() => 1_000_000);
    const intent = { type: 'agenda', agenda: { relative: 'today' } } as const;
    await putCachedIntent('k', intent, db);
    expect(await getCachedIntent('k', db)).toEqual(intent);
    expect(await getCachedIntent('missing', db)).toBeUndefined();

    setNow(() => 1_000_000 + 31 * 24 * 3600 * 1000);
    expect(await getCachedIntent('k', db)).toBeUndefined();
    await putCachedIntent('k2', intent, db);
    expect(await db.table('_aiCache').count()).toBe(1); // the expired entry was purged
  });

  it('ignores corrupt rows and can be cleared', async () => {
    await db
      .table('_aiCache')
      .put({ key: 'bad', intent: { type: 'run-shell' }, createdAt: Date.now() });
    expect(await getCachedIntent('bad', db)).toBeUndefined();
    await putCachedIntent('k', { type: 'message', text: 'x' }, db);
    await clearAiCache(db);
    expect(await db.table('_aiCache').count()).toBe(0);
  });
});

describe('usage', () => {
  it('prices known models only', () => {
    expect(estimateCostUsd('claude-haiku-4-5-20251001', 1_000_000, 100_000)).toBeCloseTo(1.5);
    expect(estimateCostUsd('llama3', 1000, 1000)).toBeUndefined();
  });

  it('sums requests and tokens; cache hits are counted separately', async () => {
    await recordUsage(
      {
        provider: 'claude',
        model: 'claude-haiku-4-5',
        inputTokens: 400,
        outputTokens: 20,
        cacheHit: false,
      },
      db,
    );
    await recordUsage(
      {
        provider: 'claude',
        model: 'claude-haiku-4-5',
        inputTokens: 600,
        outputTokens: 30,
        cacheHit: false,
      },
      db,
    );
    await recordUsage(
      {
        provider: 'claude',
        model: 'claude-haiku-4-5',
        inputTokens: 0,
        outputTokens: 0,
        cacheHit: true,
      },
      db,
    );
    const totals = await loadUsageTotals(db);
    expect(totals).toMatchObject({
      requests: 2,
      cacheHits: 1,
      inputTokens: 1000,
      outputTokens: 50,
    });
    expect(totals.costUsd).toBeCloseTo(0.00125);
    await resetUsage(db);
    expect(await loadUsageTotals(db)).toEqual({
      requests: 0,
      cacheHits: 0,
      errors: 0,
      fallbacks: 0,
      inputTokens: 0,
      outputTokens: 0,
    });
  });

  it('has no cost for unpriced models', () => {
    expect(
      totalsOf([
        {
          at: 1,
          provider: 'ollama',
          model: 'qwen',
          inputTokens: 5,
          outputTokens: 5,
          cacheHit: false,
        },
      ]).costUsd,
    ).toBeUndefined();
  });
});
