import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { t } from '@/strings';
import {
  baseUrlSchema,
  entryFromPreset,
  isLocalHost,
  loadAiConfig,
  providerEntrySchema,
  saveAiConfig,
} from './config';

const secrets = {
  protection: 'device-key' as const,
  get: async () => undefined,
  set: async () => undefined,
  delete: async () => undefined,
};

beforeEach(async () => {
  await db.table('_secrets').clear();
});

describe('baseUrlSchema', () => {
  it.each([
    '',
    '  ',
    'https://api.example.test/v1',
    'https://10.0.0.5/v1', // https anywhere is fine
    'http://localhost:11434',
    'http://LOCALHOST:11434/',
    'http://ollama.localhost:11434',
    'http://127.0.0.1:11434',
    'http://127.5.6.7:8080',
    'http://[::1]:11434',
    'http://10.0.0.5:11434',
    'http://172.16.0.9:11434',
    'http://172.31.255.1:11434',
    'http://192.168.1.20:11434',
    'http://[fd12:3456::1]:11434',
    'http://[fc00::1]:11434',
  ])('accepts %j', (url) => {
    expect(baseUrlSchema.safeParse(url).success).toBe(true);
  });

  it.each([
    'http://api.example.test/v1',
    'http://8.8.8.8/v1',
    'http://172.32.0.1/v1', // just outside 172.16/12
    'http://172.15.0.1/v1',
    'http://193.168.1.1/v1',
    'http://[2001:db8::1]/v1',
    'http://[fe80::1]/v1', // link-local is not unique-local
    'ftp://example.test',
    'not a url',
  ])('rejects %j with the German message', (url) => {
    const result = baseUrlSchema.safeParse(url);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(t.ai.settings.baseUrlInsecure);
  });

  it('is part of the provider entry schema', () => {
    const entry = entryFromPreset('openai');
    expect(providerEntrySchema.safeParse(entry).success).toBe(true);
    const insecure = providerEntrySchema.safeParse({
      ...entry,
      baseUrl: 'http://api.openai.com/v1',
    });
    expect(insecure.success).toBe(false);
    expect(insecure.error?.issues[0]?.path).toEqual(['baseUrl']);
  });

  it('every preset address passes (Ollama is http on localhost)', () => {
    for (const id of [
      'anthropic',
      'openai',
      'gemini',
      'groq',
      'openrouter',
      'mistral',
      'ollama',
      'custom',
    ] as const)
      expect(baseUrlSchema.safeParse(entryFromPreset(id).baseUrl).success).toBe(true);
  });
});

describe('isLocalHost', () => {
  it('knows loopback, private and unique-local addresses', () => {
    expect(isLocalHost('localhost')).toBe(true);
    expect(isLocalHost('[::1]')).toBe(true);
    expect(isLocalHost('10.1.2.3')).toBe(true);
    expect(isLocalHost('example.test')).toBe(false);
    expect(isLocalHost('1.1.1.1')).toBe(false);
  });
});

describe('saveAiConfig / loadAiConfig with the https rule', () => {
  it('refuses to save a plain-http address of a remote host', async () => {
    const entry = { ...entryFromPreset('custom'), baseUrl: 'http://llm.example.test/v1' };
    await expect(saveAiConfig({ v: 2, providers: [entry] })).rejects.toThrow(
      t.ai.settings.baseUrlInsecure,
    );
  });

  it('keeps a stored config whose address predates the rule: that entry is switched off, the rest stays', async () => {
    const remote = {
      ...entryFromPreset('custom'),
      id: 'custom',
      baseUrl: 'http://llm.example.test/v1',
      model: 'm',
      keySet: true,
    };
    const fine = { ...entryFromPreset('groq'), id: 'groq', keySet: true };
    await db.table('_secrets').put({ key: 'aiConfig', value: { v: 2, providers: [remote, fine] } });
    const loaded = await loadAiConfig(db, secrets);
    expect(loaded.providers.map((p) => p.id)).toEqual(['custom', 'groq']);
    expect(loaded.providers[0]).toMatchObject({ enabled: false, baseUrl: '', model: 'm' });
    expect(loaded.providers[1]).toMatchObject({ enabled: true, baseUrl: fine.baseUrl });
    // The salvaged config is saveable again.
    await expect(saveAiConfig(loaded)).resolves.toBeDefined();
  });
});
