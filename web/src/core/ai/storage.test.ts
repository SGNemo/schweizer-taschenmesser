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
import {
  createProvider,
  defaultAiConfig,
  isAiConfigured,
  loadAiConfig,
  saveAiConfig,
} from './config';
import { estimateCostUsd, loadUsageTotals, recordUsage, resetUsage, totalsOf } from './usage';

beforeEach(async () => {
  await db.table('_secrets').clear();
  await db.table('_aiCache').clear();
  await db.table('_aiUsage').clear();
});
afterEach(() => setNow());

describe('config', () => {
  it('defaults to "off" and persists patches locally', async () => {
    expect(await loadAiConfig(db)).toEqual(defaultAiConfig());
    expect(defaultAiConfig()).toMatchObject({
      provider: 'off',
      claudeModel: 'claude-haiku-4-5',
      ollamaUrl: 'http://localhost:11434',
    });
    await saveAiConfig({ provider: 'claude', anthropicKey: 'sk-ant-x' }, db);
    await saveAiConfig({ claudeModel: 'claude-sonnet-5-5' }, db);
    expect(await loadAiConfig(db)).toMatchObject({
      provider: 'claude',
      anthropicKey: 'sk-ant-x',
      claudeModel: 'claude-sonnet-5-5',
    });
  });

  it('never writes the key to a synced table', async () => {
    await saveAiConfig({ provider: 'claude', anthropicKey: 'sk-ant-secret' }, db);
    expect(await db.table('_settings').count()).toBe(0);
    expect(await db.table('_outbox').count()).toBe(0);
  });

  it('creates a provider only for a complete configuration', () => {
    const base = defaultAiConfig();
    expect(createProvider(base)).toBeUndefined();
    expect(isAiConfigured({ ...base, provider: 'claude', anthropicKey: '  ' })).toBe(false);
    expect(createProvider({ ...base, provider: 'claude', anthropicKey: 'k' })).toMatchObject({
      id: 'claude',
      model: 'claude-haiku-4-5',
    });
    expect(createProvider({ ...base, provider: 'ollama' })).toMatchObject({
      id: 'ollama',
      model: 'qwen2.5:7b',
    });
    expect(createProvider({ ...base, provider: 'ollama', ollamaUrl: '' })).toBeUndefined();
  });
});

describe('cache', () => {
  const parts = {
    question: 'Was kostet Netflix?',
    today: '2026-09-29',
    schemaHash: 'abc',
    provider: 'claude',
    model: 'm',
  };

  it('normalizes questions', () => {
    expect(normalizeQuestion('  Was kostet   NETFLIX?! ')).toBe('was kostet netflix');
    expect(normalizeQuestion('Übersicht')).toBe('ubersicht');
  });

  it('keys depend on question, date, schema and model', async () => {
    const base = await cacheKey(parts);
    expect(await cacheKey({ ...parts, question: ' was kostet netflix ' })).toBe(base);
    expect(await cacheKey({ ...parts, today: '2026-09-30' })).not.toBe(base);
    expect(await cacheKey({ ...parts, schemaHash: 'def' })).not.toBe(base);
    expect(await cacheKey({ ...parts, model: 'other' })).not.toBe(base);
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
