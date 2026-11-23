/**
 * AI1 (launch review 2026-11): a chat that already went to a provider stays with it. A pinned
 * request is sent to that provider only; if it is paused, over its limit or gone, the router says so
 * (`provider-paused`) instead of handing the conversation to the next provider.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { clearCooldown, createRouter, type RouterMember } from './router';
import {
  AiError,
  type AiErrorCode,
  type AiProvider,
  type CompletionRequest,
  type CompletionResult,
} from './providers/types';
import { recordUsage } from './usage';
import { setNow } from '@/core/time/now';

const ok = (model = 'm'): CompletionResult => ({
  toolCalls: [],
  text: 'Antwort',
  usage: { inputTokens: 10, outputTokens: 5 },
  model,
});

function fake(id: string, steps: (CompletionResult | AiError)[] = []) {
  const queue = [...steps];
  return {
    id,
    model: `${id}-model`,
    complete: vi.fn(async () => {
      const next = queue.shift() ?? ok(`${id}-model`);
      if (next instanceof Error) throw next;
      return next;
    }),
  } satisfies AiProvider;
}
const member = (
  provider: AiProvider,
  extra: Partial<RouterMember['entry']> = {},
): RouterMember => ({
  entry: { id: provider.id, label: `Label ${provider.id}`, limits: {}, price: undefined, ...extra },
  provider,
});
const err = (code: AiErrorCode) => new AiError(code, code);

let clock = 0;
const route = (members: RouterMember[]) => createRouter({ members, now: () => clock });
const CHAT: CompletionRequest = {
  system: 's',
  user: 'u',
  tools: [],
  history: [
    { role: 'user', content: 'Frage mit Daten' },
    { role: 'assistant', content: 'Antwort' },
  ],
};
const codeOf = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof AiError ? e.code : String(e);
  }
};

beforeEach(async () => {
  clearCooldown();
  clock = new Date(2026, 10, 23, 12, 0, 0).getTime();
  setNow(() => clock);
  await db.table('_aiUsage').clear();
});

afterEach(() => setNow());

describe('router: a pinned chat stays with its provider', () => {
  it('sends a pinned request to that provider only, even when it is not first', async () => {
    const a = fake('a');
    const b = fake('b');
    const result = await route([member(a), member(b)]).complete({
      ...CHAT,
      pin: { providerId: 'b' },
    });
    expect(result.providerId).toBe('b');
    expect(result.providerLabel).toBe('Label b');
    expect(a.complete).not.toHaveBeenCalled();
  });

  it('never switches after an error: the next message gets "provider-paused", nobody else is asked', async () => {
    const a = fake('a', [err('server')]);
    const b = fake('b');
    const r = route([member(a), member(b)]);
    const pinned = { ...CHAT, pin: { providerId: 'a' } } as const;
    expect(await codeOf(r.complete(pinned))).toBe('server');
    // "try again" / the next message while "a" cools down
    const paused = await r.complete(pinned).catch((e: unknown) => e);
    expect(paused).toBeInstanceOf(AiError);
    expect((paused as AiError).code).toBe('provider-paused');
    expect(b.complete).not.toHaveBeenCalled();
  });

  it('a pinned provider over its limit or no longer configured is "provider-paused" too', async () => {
    const a = fake('a');
    const b = fake('b');
    await recordUsage({
      provider: 'a',
      model: 'a-model',
      inputTokens: 1,
      outputTokens: 1,
      cacheHit: false,
      outcome: 'ok',
    });
    const limited = route([member(a, { limits: { requestsPerDay: 1 } }), member(b)]);
    expect(await codeOf(limited.complete({ ...CHAT, pin: { providerId: 'a' } }))).toBe(
      'provider-paused',
    );
    expect(await codeOf(route([member(b)]).complete({ ...CHAT, pin: { providerId: 'a' } }))).toBe(
      'provider-paused',
    );
    expect(a.complete).not.toHaveBeenCalled();
    expect(b.complete).not.toHaveBeenCalled();
  });

  it('the same id with another fingerprint (other device, re-created entry) is not the pinned provider', async () => {
    const a = fake('custom');
    const e = await route([{ ...member(a), ref: 'other-endpoint' }])
      .complete({ ...CHAT, pin: { providerId: 'custom', ref: 'endpoint-1' } })
      .then(
        () => new AiError('invalid-response', 'expected an error'),
        (x: unknown) => x as AiError,
      );
    expect(e).toMatchObject({ code: 'provider-paused', message: 'not-set-up' });
    expect(a.complete).not.toHaveBeenCalled();
    const ok = await route([{ ...member(a), ref: 'endpoint-1' }]).complete({
      ...CHAT,
      pin: { providerId: 'custom', ref: 'endpoint-1' },
    });
    expect(ok.providerRef).toBe('endpoint-1');
  });

  it('a cooling or limited pin says "paused", a missing one "not-set-up"', async () => {
    const a = fake('a', [err('server')]);
    const r = route([member(a)]);
    await codeOf(r.complete({ ...CHAT, pin: { providerId: 'a' } }));
    const paused = await r.complete({ ...CHAT, pin: { providerId: 'a' } }).then(
      () => new AiError('invalid-response', 'expected an error'),
      (x: unknown) => x as AiError,
    );
    expect(paused.message).toBe('paused');
    const missing = await r.complete({ ...CHAT, pin: { providerId: 'gone' } }).then(
      () => new AiError('invalid-response', 'expected an error'),
      (x: unknown) => x as AiError,
    );
    expect(missing.message).toBe('not-set-up');
  });

  it('names the provider a stopped request had already reached', async () => {
    const a = fake('a', [err('aborted')]);
    const e = await route([member(a)])
      .complete({ ...CHAT, history: [] })
      .then(
        () => new AiError('invalid-response', 'expected an error'),
        (x: unknown) => x as AiError,
      );
    expect(e.code).toBe('aborted');
    expect(e.reached).toEqual({ providerId: 'a', label: 'Label a', ref: 'a' });
  });

  it('a failed pinned call names the provider it went to', async () => {
    const a = fake('a', [err('network')]);
    const e = await route([member(a)])
      .complete({ ...CHAT, pin: { providerId: 'a' } })
      .then(
        () => new AiError('invalid-response', 'expected an error'),
        (x: unknown) => x as AiError,
      );
    expect(e.attempts?.[0]?.providerId).toBe('a');
    expect(e.reached?.providerId).toBe('a');
  });

  it('the assistant (no history, no user data) keeps the fallback chain', async () => {
    const a = fake('a', [err('server')]);
    const b = fake('b');
    const result = await route([member(a), member(b)]).complete({
      system: 's',
      user: 'u',
      tools: [],
    });
    expect(result.providerId).toBe('b');
  });
});
