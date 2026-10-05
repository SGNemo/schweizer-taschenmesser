import { describe, expect, it } from 'vitest';
import { issueForDonation } from '../src/issue.ts';
import { parsePayload } from '../src/kofi.ts';
import { backoffSeconds, handleQueue } from '../src/queue.ts';
import { DLQ_NAME, MAX_ATTEMPTS, QUEUE_NAME, type MailJob } from '../src/types.ts';
import { batchOf, donation, makeDeps, makeEnv, makeMessage, OWNER } from './helpers.ts';

async function issued() {
  const ctx = makeEnv();
  const deps = makeDeps();
  const r = await issueForDonation(ctx.env, deps.deps, parsePayload(donation())!);
  if (!r.ok) throw new Error('setup failed');
  return { ...ctx, job: ctx.jobs[0]! as MailJob, txKey: r.txKey };
}

describe('mail queue consumer', () => {
  it('sends the mail (German and English, with the code), acks and marks the record sent', async () => {
    const { env, kv, job, txKey } = await issued();
    const { deps, calls } = makeDeps([200]);
    const msg = makeMessage(job);
    await handleQueue(batchOf(QUEUE_NAME, msg), env, deps);
    expect(msg.ack).toHaveBeenCalledOnce();
    expect(msg.retry).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.to).toEqual([job.to]);
    expect(calls[0]!.text).toContain(job.code);
    expect(calls[0]!.text).toMatch(/Hallo und vielen Dank/);
    expect(calls[0]!.text).toMatch(/thank you so much/);
    expect(calls[0]!.text).toMatch(/kostenlos/);
    expect(JSON.parse(kv.data.get(`tx:${txKey}`)!).mail).toBe('sent');
  });

  it('sets Reply-To and offers replying only when a reply address is configured', async () => {
    const withReply = await issued();
    withReply.env.REPLY_TO = 'support@example.invalid';
    const a = makeDeps([200]);
    await handleQueue(batchOf(QUEUE_NAME, makeMessage(withReply.job)), withReply.env, a.deps);
    expect(a.calls[0]!.replyTo).toBe('support@example.invalid');
    expect(a.calls[0]!.text).toContain('Antworte einfach auf diese Mail');

    const without = await issued();
    const b = makeDeps([200]);
    await handleQueue(batchOf(QUEUE_NAME, makeMessage(without.job)), without.env, b.deps);
    expect(b.calls[0]!.replyTo).toBeUndefined();
    expect(b.calls[0]!.text).not.toContain('Antworte einfach');
    expect(b.calls[0]!.text).toContain('Kontakt auf der Spendenseite');
  });

  it('retries a temporary failure with growing backoff', async () => {
    const { env, job } = await issued();
    for (const [attempt, status] of [
      [1, 500],
      [2, 429],
      [3, 503],
    ] as const) {
      const msg = makeMessage(job, attempt);
      await handleQueue(batchOf(QUEUE_NAME, msg), env, makeDeps([status]).deps);
      expect(msg.ack).not.toHaveBeenCalled();
      expect(msg.retry).toHaveBeenCalledWith({ delaySeconds: backoffSeconds(attempt) });
    }
    expect([1, 2, 3, 4, 5].map(backoffSeconds)).toEqual([60, 120, 240, 480, 960]);
  });

  it('a network error counts as temporary', async () => {
    const { env, job } = await issued();
    const deps = makeDeps().deps;
    deps.fetch = async () => {
      throw new Error('offline');
    };
    const msg = makeMessage(job);
    await handleQueue(batchOf(QUEUE_NAME, msg), env, deps);
    expect(msg.retry).toHaveBeenCalledOnce();
  });

  it('after the last attempt the maintainer is told – with a hash prefix, never the donor data', async () => {
    const { env, kv, job, txKey } = await issued();
    const { deps, calls } = makeDeps([500, 200]); // donor mail fails, owner mail works
    const msg = makeMessage(job, MAX_ATTEMPTS);
    await handleQueue(batchOf(QUEUE_NAME, msg), env, deps);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.to).toEqual([OWNER]);
    expect(calls[1]!.text).toContain(txKey.slice(0, 12));
    expect(calls[1]!.text).not.toContain(job.to);
    expect(calls[1]!.text).not.toContain(job.code);
    expect(msg.ack).toHaveBeenCalledOnce();
    expect(JSON.parse(kv.data.get(`tx:${txKey}`)!).mail).toBe('failed');
  });

  it('a permanent failure (e.g. unverified domain, invalid address) goes straight to the maintainer', async () => {
    const { env, job } = await issued();
    const { deps, calls } = makeDeps([422, 200]);
    const msg = makeMessage(job, 1);
    await handleQueue(batchOf(QUEUE_NAME, msg), env, deps);
    expect(msg.retry).not.toHaveBeenCalled();
    expect(calls[1]!.to).toEqual([OWNER]);
    expect(msg.ack).toHaveBeenCalledOnce();
  });

  it('if even the notice fails the message is not dropped', async () => {
    const { env, job } = await issued();
    const msg = makeMessage(job, MAX_ATTEMPTS);
    await handleQueue(batchOf(QUEUE_NAME, msg), env, makeDeps([500]).deps);
    expect(msg.ack).not.toHaveBeenCalled();
    expect(msg.retry).toHaveBeenCalledOnce();
  });

  it('the dead-letter queue reports to the maintainer and acks', async () => {
    const { env, kv, job, txKey } = await issued();
    const { deps, calls } = makeDeps([200]);
    const msg = makeMessage(job);
    await handleQueue(batchOf(DLQ_NAME, msg), env, deps);
    expect(calls[0]!.to).toEqual([OWNER]);
    expect(msg.ack).toHaveBeenCalledOnce();
    expect(JSON.parse(kv.data.get(`tx:${txKey}`)!).mail).toBe('failed');
  });
});
