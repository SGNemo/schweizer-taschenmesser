import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const digest = (s: string): Buffer => createHash('sha256').update(s).digest();

/** Minimum length for configured tokens; refuses guessable ones at startup. */
export const MIN_TOKEN_LENGTH = 16;

/**
 * Bearer token check. Tokens are hashed first so the comparison is constant-time regardless of
 * token length, and every configured token is always compared (no early exit).
 */
export function createAuth(
  tokens: readonly string[],
): (authorization: string | undefined) => boolean {
  const known = tokens.map(digest);
  return (authorization) => {
    const match = /^Bearer (.+)$/.exec(authorization ?? '');
    if (!match) return false;
    const given = digest(match[1]!);
    let ok = false;
    for (const k of known) if (timingSafeEqual(k, given)) ok = true;
    return ok;
  };
}

export type AuthResult =
  /** One of the configured shared tokens (`SYNC_TOKEN(S)`): may manage devices and reset. */
  | { role: 'admin' }
  /** A per-device token issued by `POST /v1/devices`. */
  | { role: 'device'; deviceId: string }
  /** A device token that was revoked. */
  | { role: 'revoked'; deviceId: string };

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

/** 256 random bits, base64url: shown once to the device, stored only as a hash. */
export const newDeviceToken = (): string => randomBytes(32).toString('base64url');

/**
 * Extends the shared-token check with per-device tokens. Shared tokens are the admin role (they
 * keep working exactly as before); a device token identifies one device and can be revoked.
 */
export function createAuthenticator(
  tokens: readonly string[],
  lookup: (tokenHash: string) => { id: string; revoked: boolean } | undefined,
): (authorization: string | undefined) => AuthResult | undefined {
  const isShared = createAuth(tokens);
  return (authorization) => {
    if (isShared(authorization)) return { role: 'admin' };
    const match = /^Bearer (.+)$/.exec(authorization ?? '');
    if (!match) return undefined;
    const device = lookup(hashToken(match[1]!));
    if (!device) return undefined;
    return { role: device.revoked ? 'revoked' : 'device', deviceId: device.id };
  };
}

/** Counts failed logins per client address in a fixed window (in memory; resets on restart). */
export function createFailureLimiter(
  limit: number,
  windowMs: number,
  now: () => number = Date.now,
) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  const live = (key: string) => {
    const b = buckets.get(key);
    if (!b) return undefined;
    if (b.resetAt <= now()) {
      buckets.delete(key);
      return undefined;
    }
    return b;
  };
  return {
    /** Seconds until the address may try again, or 0. */
    blockedFor(key: string): number {
      const b = live(key);
      return b && b.count >= limit ? Math.ceil((b.resetAt - now()) / 1000) : 0;
    },
    fail(key: string): void {
      if (buckets.size > 10_000) for (const k of buckets.keys()) live(k);
      const b = live(key);
      if (b) b.count++;
      else buckets.set(key, { count: 1, resetAt: now() + windowMs });
    },
  };
}
