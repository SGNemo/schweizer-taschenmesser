import { parseRecord } from './issue.ts';
import { log } from './log.ts';
import { renderCodeMail, sendMail } from './mail.ts';
import {
  DLQ_NAME,
  MAX_ATTEMPTS,
  RECORD_TTL_SECONDS,
  type Deps,
  type Env,
  type MailJob,
} from './types.ts';

export interface MessageLike {
  body: MailJob;
  attempts: number;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
}
export interface BatchLike {
  queue: string;
  messages: readonly MessageLike[];
}

/** 1, 2, 4, 8, 16 minutes: gives a mail provider outage or a DNS fix time to pass. */
export const backoffSeconds = (attempt: number): number => Math.min(60 * 2 ** (attempt - 1), 3600);

async function markStatus(env: Env, txKey: string, mail: 'sent' | 'failed'): Promise<void> {
  const key = `tx:${txKey}`;
  const record = parseRecord(await env.KV.get(key));
  if (record)
    await env.KV.put(key, JSON.stringify({ ...record, mail }), {
      expirationTtl: RECORD_TTL_SECONDS,
    });
}

/**
 * Tells the maintainer that a supporter mail could not be delivered. It carries only a short
 * transaction prefix and the tier – never the donor's address, name or code. The donor's address is
 * in the Ko-fi dashboard (find the donation there); the code is in KV under `tx:<prefix…>`.
 */
async function notifyOwner(env: Env, deps: Deps, job: MailJob): Promise<boolean> {
  const prefix = job.txKey.slice(0, 12);
  const { result, status } = await sendMail(env, deps, env.OWNER_EMAIL, {
    subject: 'Nemo supporter mail could not be delivered',
    text: [
      'A supporter code mail failed after all retries.',
      '',
      `Transaction hash prefix: ${prefix}`,
      `Tier: ${job.tier}`,
      '',
      `Find the record:  wrangler kv key list --binding KV --prefix tx:${prefix}`,
      'Read the code:    wrangler kv key get --binding KV "<full key from the list>"',
      'The donor address is in your Ko-fi dashboard. Send the code by hand, or let the donor use the "send again" page.',
    ].join('\n'),
    html: `<p>A supporter code mail failed after all retries.</p><p>Transaction hash prefix: <code>${prefix}</code><br>Tier: ${job.tier}</p><p>Find it: <code>wrangler kv key list --binding KV --prefix tx:${prefix}</code></p><p>The donor address is in your Ko-fi dashboard.</p>`,
  });
  log('owner-notice', { result: result === 'ok' ? 'sent' : 'failed', status });
  return result === 'ok';
}

/** Queue consumer for `supporter-mail`: send, retry with backoff, give up loudly after MAX_ATTEMPTS. */
export async function processMailBatch(batch: BatchLike, env: Env, deps: Deps): Promise<void> {
  for (const msg of batch.messages) {
    const job = msg.body;
    const txp = job.txKey.slice(0, 8);
    const { result, status } = await sendMail(
      env,
      deps,
      job.to,
      renderCodeMail(job.code, job.tier, !!env.REPLY_TO),
    );

    if (result === 'ok') {
      await markStatus(env, job.txKey, 'sent');
      log('mail', { txp, kind: job.kind, result: 'sent', attempt: msg.attempts, status });
      msg.ack();
      continue;
    }

    if (result === 'retry' && msg.attempts < MAX_ATTEMPTS) {
      log('mail', { txp, kind: job.kind, result: 'retry', attempt: msg.attempts, status });
      msg.retry({ delaySeconds: backoffSeconds(msg.attempts) });
      continue;
    }

    // Final failure (not retryable, or out of attempts): tell the maintainer, then stop.
    await markStatus(env, job.txKey, 'failed');
    const notified = await notifyOwner(env, deps, job);
    log('mail', {
      txp,
      kind: job.kind,
      result: notified ? 'failed-notified' : 'failed-notify-error',
      status, // Resend's answer for the donor mail (e.g. 401 key, 403 domain, 422 address)
    });
    // If even the notice failed, let the queue retry/dead-letter it once more rather than lose it.
    if (notified) msg.ack();
    else msg.retry({ delaySeconds: backoffSeconds(MAX_ATTEMPTS) });
  }
}

/** Backstop: whatever reaches the dead-letter queue is reported to the maintainer once more. */
export async function processDlqBatch(batch: BatchLike, env: Env, deps: Deps): Promise<void> {
  for (const msg of batch.messages) {
    await markStatus(env, msg.body.txKey, 'failed');
    const notified = await notifyOwner(env, deps, msg.body);
    log('dlq', { txp: msg.body.txKey.slice(0, 8), result: notified ? 'notified' : 'notify-error' });
    msg.ack();
  }
}

export function handleQueue(batch: BatchLike, env: Env, deps: Deps): Promise<void> {
  return batch.queue === DLQ_NAME
    ? processDlqBatch(batch, env, deps)
    : processMailBatch(batch, env, deps);
}
