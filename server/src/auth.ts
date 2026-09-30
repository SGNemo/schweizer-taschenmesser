import { createHash, timingSafeEqual } from 'node:crypto';

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
