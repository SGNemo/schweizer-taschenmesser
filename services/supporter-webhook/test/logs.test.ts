import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleFetch } from '../src/index.ts';
import { handleQueue } from '../src/queue.ts';
import { QUEUE_NAME } from '../src/types.ts';
import {
  batchOf,
  donation,
  kofiRequest,
  makeDeps,
  makeEnv,
  makeMessage,
  TOKEN,
} from './helpers.ts';

afterEach(() => vi.restoreAllMocks());

describe('logs', () => {
  it('contain no personal data, code, token or amount in any scenario', async () => {
    const lines: string[] = [];
    for (const m of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, m).mockImplementation((...a: unknown[]) => {
        lines.push(a.map(String).join(' '));
      });
    }
    const { env, jobs } = makeEnv();
    const { deps } = makeDeps([200]);
    const payload = donation();

    await handleFetch(kofiRequest(payload), env, deps); // issued
    await handleFetch(kofiRequest(payload), env, deps); // duplicate
    await handleFetch(kofiRequest(donation({ email: 'other@example.invalid' })), env, deps); // address-mismatch
    await handleFetch(kofiRequest(payload), { ...env, RATE_LIMITER: undefined }, deps); // misconfigured
    await handleFetch(kofiRequest(donation({ verification_token: 'bad-token-xyz' })), env, deps);
    await handleFetch(kofiRequest(donation({ type: 'Shop Order' })), env, deps);
    await handleFetch(
      new Request('https://h.example.invalid/resend', {
        method: 'POST',
        body: 'email=ada.donor%40example.invalid',
      }),
      env,
      deps,
    );

    const job = jobs[0]!;
    await handleQueue(batchOf(QUEUE_NAME, makeMessage(job)), env, makeDeps([200]).deps);
    await handleQueue(batchOf(QUEUE_NAME, makeMessage(job, 1)), env, makeDeps([500]).deps);
    await handleQueue(batchOf(QUEUE_NAME, makeMessage(job, 5)), env, makeDeps([500, 200]).deps);

    expect(lines.length).toBeGreaterThan(5);
    const all = lines.join('\n');
    for (const secret of [
      'ada.donor',
      'other@',
      'example.invalid',
      'Ada Beispiel',
      job.code,
      job.code.slice(10, 40),
      TOKEN,
      'bad-token-xyz',
      '11111111-2222',
      '5.00',
      env.HASH_PEPPER,
      env.RESEND_API_KEY,
      env.SUPPORTER_SIGNING_KEY,
    ]) {
      expect(all, `log leaked "${secret.slice(0, 12)}…"`).not.toContain(secret);
    }
    for (const line of lines) expect(() => JSON.parse(line)).not.toThrow(); // structured only
  });
});
