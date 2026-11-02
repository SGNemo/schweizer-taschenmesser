// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { providerEntrySchema, type AiConfig, type ProviderEntry } from '@/core/ai/config';
import { LOCAL_MODELS } from '@/core/ai/local/catalogue';
import {
  findLocalMailModel,
  isLoopbackHost,
  loopbackOnly,
  LocalOnlyError,
  type LocalDeps,
} from './localAi';

const entry = (over: Partial<ProviderEntry>): ProviderEntry =>
  providerEntrySchema.parse({
    id: 'p',
    preset: 'ollama',
    kind: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'qwen2.5:7b',
    tier: 'local',
    keyRequired: false,
    ...over,
  });

const cloud = (kind: 'anthropic' | 'openai-compatible', over: Partial<ProviderEntry> = {}) =>
  entry({
    id: `cloud-${kind}`,
    preset: kind === 'anthropic' ? 'anthropic' : 'openai',
    kind,
    baseUrl: kind === 'anthropic' ? '' : 'https://api.openai.com/v1',
    model: 'some-model',
    tier: 'paid',
    keyRequired: true,
    keySet: true,
    ...over,
  });

const answer = (text: string) =>
  new Response(JSON.stringify({ model: 'qwen2.5:7b', message: { content: text } }), {
    status: 200,
  });

function deps(providers: ProviderEntry[], over: Partial<LocalDeps> = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return answer('Antwort');
  });
  const d: LocalDeps = {
    config: async () => ({ v: 2, providers }) as AiConfig,
    fetch: fetchSpy as unknown as typeof fetch,
    builtinReady: async () => false,
    builtinLoad: async () => true,
    generate: async () => ' built-in answer ',
    builtinTemplate: () => LOCAL_MODELS[0],
    ...over,
  };
  return { d, calls, fetchSpy };
}

describe('isLoopbackHost', () => {
  it('is this machine only – not the home network, not the internet', () => {
    for (const h of [
      'localhost',
      'LOCALHOST',
      'x.localhost',
      '127.0.0.1',
      '127.9.9.9',
      '::1',
      '[::1]',
    ])
      expect(isLoopbackHost(h), h).toBe(true);
    for (const h of [
      '192.168.1.5',
      '10.0.0.2',
      '172.16.0.1',
      'ollama.example.org',
      '8.8.8.8',
      'localhost.evil.org',
      '0.0.0.0',
    ])
      expect(isLoopbackHost(h), h).toBe(false);
  });
});

describe('findLocalMailModel never picks a model off this machine', () => {
  it('no local model at all: none – and no network call', async () => {
    const { d, fetchSpy } = deps([]);
    expect(await findLocalMailModel(d)).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('cloud providers are never used, however many are set up (no fallback)', async () => {
    const { d, fetchSpy } = deps([cloud('anthropic'), cloud('openai-compatible')]);
    expect(await findLocalMailModel(d)).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('an Ollama entry that is not on this machine (LAN, other host, https) is not used either', async () => {
    for (const baseUrl of [
      'http://192.168.1.5:11434',
      'https://ollama.example.org',
      'http://10.0.0.3:11434',
    ]) {
      const { d, fetchSpy } = deps([entry({ baseUrl })]);
      expect(await findLocalMailModel(d), baseUrl).toBeUndefined();
      expect(fetchSpy).not.toHaveBeenCalled();
    }
  });

  it('a disabled or incomplete local entry is skipped; the first loopback one wins over cloud ones', async () => {
    const { d } = deps([
      cloud('anthropic'),
      entry({ id: 'off', enabled: false }),
      entry({ id: 'nomodel', model: '' }),
      entry({ id: 'ok', baseUrl: 'http://127.0.0.1:11434' }),
    ]);
    const m = await findLocalMailModel(d);
    expect(m).toMatchObject({ source: 'ollama', model: 'qwen2.5:7b' });
  });

  it('a tier that says cloud on an Ollama kind is not local', async () => {
    const { d } = deps([entry({ tier: 'paid' })]);
    expect(await findLocalMailModel(d)).toBeUndefined();
  });
});

describe('the Ollama route', () => {
  it('sends the text only to the loopback address, as plain chat without tools, never following a redirect', async () => {
    const { d, calls } = deps([entry({})]);
    const m = (await findLocalMailModel(d))!;
    expect(await m.complete('system text', 'mail text', { maxTokens: 50 })).toBe('Antwort');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('http://localhost:11434/api/chat');
    expect(calls[0]!.init.redirect).toBe('error');
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.tools).toBeUndefined();
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'mail text' });
  });

  it('loopbackOnly refuses any other host before a request is made, and a bad address', () => {
    const inner = vi.fn();
    const guarded = loopbackOnly(inner as unknown as typeof fetch);
    expect(() => guarded('https://api.example.org/x')).toThrow(LocalOnlyError);
    expect(() => guarded('http://192.168.1.5:11434/api/chat')).toThrow(LocalOnlyError);
    expect(() => guarded('not a url')).toThrow(LocalOnlyError);
    expect(inner).not.toHaveBeenCalled();
    guarded('http://localhost:11434/api/chat');
    expect(inner).toHaveBeenCalledTimes(1);
  });
});

describe('the built-in route', () => {
  it('comes first, runs inside the app and makes no network call', async () => {
    const generate = vi.fn(async (_prompt: string, _max: number) => ' built-in answer ');
    const { d, fetchSpy } = deps([entry({})], { builtinReady: async () => true, generate });
    const m = (await findLocalMailModel(d))!;
    expect(m.source).toBe('built-in');
    expect(await m.complete('sys', 'user text')).toBe('built-in answer');
    expect(generate).toHaveBeenCalledTimes(1);
    expect(String(generate.mock.calls[0]![0])).toContain('user text');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('a model that cannot be loaded is an error, not a reason to ask a cloud model', async () => {
    const { d, fetchSpy } = deps([cloud('anthropic')], {
      builtinReady: async () => true,
      builtinLoad: async () => false,
    });
    const m = (await findLocalMailModel(d))!;
    await expect(m.complete('s', 'u')).rejects.toMatchObject({ code: 'no-model' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
