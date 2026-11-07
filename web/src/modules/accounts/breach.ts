/**
 * Optional "known leak" check against the Have I Been Pwned range API (k-anonymity). The only thing that leaves
 * the device is the first 5 hex characters of the uppercase SHA-1 of a password; the answer (all suffixes with
 * that prefix, padded) is compared here. No username, title, URL or entry id is part of a request, and nothing
 * here logs or stores a password, hash, prefix or response. Called only when the setting is on.
 */
import { getPlatform } from '@/core/platform';

export const BREACH_RANGE_URL = 'https://api.pwnedpasswords.com/range/';
const PREFIX_LENGTH = 5;
const TIMEOUT_MS = 10_000;

/** The check could not run (offline, blocked, service error); the rest of the audit is unaffected. */
export class BreachUnavailable extends Error {
  constructor() {
    super('breach check unavailable');
    this.name = 'BreachUnavailable';
  }
}

type Fetch = typeof fetch;

/** Uppercase hex SHA-1 (Web Crypto, no dependency). */
export async function sha1Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/** Splits a hash into the part that is sent and the part that stays here. */
export function splitHash(hash: string): { prefix: string; suffix: string } {
  return { prefix: hash.slice(0, PREFIX_LENGTH), suffix: hash.slice(PREFIX_LENGTH) };
}

/** Whether `suffix` is listed in a range response ("SUFFIX:COUNT" per line; padding rows have count 0). */
export function findSuffix(body: string, suffix: string): boolean {
  for (const line of body.split('\n')) {
    const [s, count] = line.trim().split(':');
    if (s?.toUpperCase() === suffix && Number(count) > 0) return true;
  }
  return false;
}

async function fetchRange(prefix: string, f: Fetch, signal?: AbortSignal): Promise<string> {
  try {
    const res = await f(`${BREACH_RANGE_URL}${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)])
        : AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new BreachUnavailable();
    return await res.text();
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new BreachUnavailable();
  }
}

/**
 * Ids of the entries whose password appears in a known leak. Sequential; one request per distinct prefix.
 * Throws `BreachUnavailable` on the first failure (the caller then shows "not available").
 */
export async function findBreached(
  entries: readonly { id: string; data: { password: string } }[],
  opts: { fetch?: Fetch; signal?: AbortSignal } = {},
): Promise<string[]> {
  const f: Fetch = opts.fetch ?? ((input, init) => getPlatform().fetch(input, init));
  const ranges = new Map<string, string>();
  const found: string[] = [];
  for (const e of entries) {
    if (!e.data.password) continue;
    if (opts.signal?.aborted) return found;
    const { prefix, suffix } = splitHash(await sha1Hex(e.data.password));
    let body = ranges.get(prefix);
    if (body === undefined) {
      body = await fetchRange(prefix, f, opts.signal);
      ranges.set(prefix, body);
    }
    if (findSuffix(body, suffix)) found.push(e.id);
  }
  return found;
}
