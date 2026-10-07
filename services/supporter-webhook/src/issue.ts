import { encodeCode, fromHex, sanitizeName } from '../../../packages/supporter-codes/src/index.ts';
import { hmacHex, normaliseEmail, safeEqual } from './hash.ts';
import type { KofiPayload } from './kofi.ts';
import { log } from './log.ts';
import { tierOf } from './tier.ts';
import { RECORD_TTL_SECONDS, type Deps, type Env, type TxRecord } from './types.ts';

export type IssueResult =
  | { ok: true; duplicate: boolean; txKey: string }
  | { ok: false; reason: 'amount' | 'misconfigured' };

export function parseRecord(raw: string | null): TxRecord | null {
  if (!raw) return null;
  try {
    const r = JSON.parse(raw) as Partial<TxRecord>;
    return typeof r.code === 'string' &&
      typeof r.emailMac === 'string' &&
      (r.tier === 'kaffee' || r.tier === 'kuchen' || r.tier === 'developer')
      ? (r as TxRecord)
      : null;
  } catch {
    return null;
  }
}

/**
 * One verified donation → one code. Idempotent: the same transaction id always gives the same
 * code (a repeated webhook just mails it again). Stores hashes only, never the address.
 */
export async function issueForDonation(env: Env, deps: Deps, p: KofiPayload): Promise<IssueResult> {
  const txKey = await hmacHex(env.HASH_PEPPER, `kofi:${p.kofi_transaction_id}`);
  const email = normaliseEmail(p.email);
  const existing = parseRecord(await env.KV.get(`tx:${txKey}`));

  if (existing) {
    // A replayed transaction id with a different address must not redirect the stored code:
    // only the address the code was issued to gets it again (constant-time compare of the MACs).
    const emailMac = await hmacHex(env.HASH_PEPPER, `mail:${email}`);
    if (!(await safeEqual(existing.emailMac, emailMac))) {
      log('duplicate', { txp: txKey.slice(0, 8), result: 'address-mismatch' });
      return { ok: true, duplicate: true, txKey };
    }
    await env.MAIL_QUEUE.send({
      kind: 'code',
      txKey,
      to: email,
      code: existing.code,
      tier: existing.tier,
    });
    log('duplicate', { txp: txKey.slice(0, 8), result: 'resent' });
    return { ok: true, duplicate: true, txKey };
  }

  const tier = tierOf(p.amount, p.currency);
  if (!tier) return { ok: false, reason: 'amount' };

  const secretKey = fromHex(env.SUPPORTER_SIGNING_KEY);
  const keyId = Number(env.SIGNING_KEY_ID);
  if (secretKey?.length !== 32 || !Number.isInteger(keyId))
    return { ok: false, reason: 'misconfigured' };

  // A name only for a public donation and only as the supporter wrote it (sanitised, ≤ 20 chars).
  const name = p.is_public ? sanitizeName(p.from_name) : '';
  const code = encodeCode(
    { keyId, tier, issued: deps.now().toISOString().slice(0, 10), name },
    secretKey,
  );

  const emailMac = await hmacHex(env.HASH_PEPPER, `mail:${email}`);
  const record: TxRecord = { code, tier, emailMac, mail: 'queued' };
  await env.KV.put(`tx:${txKey}`, JSON.stringify(record), { expirationTtl: RECORD_TTL_SECONDS });
  // Index for "send my code again" by address alone (the key is a keyed hash, not the address).
  await env.KV.put(`em:${emailMac}`, txKey, { expirationTtl: RECORD_TTL_SECONDS });
  const issued = Number((await env.KV.get('stats:issued')) ?? '0') || 0;
  await env.KV.put('stats:issued', String(issued + 1));

  // If this throws the webhook answers 500, Ko-fi retries, and the record above makes it a duplicate.
  await env.MAIL_QUEUE.send({ kind: 'code', txKey, to: email, code, tier });
  log('issued', { txp: txKey.slice(0, 8), tier, result: 'queued' });
  return { ok: true, duplicate: false, txKey };
}
