const enc = new TextEncoder();

async function hmacBytes(key: string, message: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(message)));
}

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

/** Keyed hash for idempotency keys and address matching; the pepper is a Worker secret. */
export async function hmacHex(pepper: string, message: string): Promise<string> {
  return hex(await hmacBytes(pepper, message));
}

/** Constant-time string comparison (both sides are hashed first, so length does not leak). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all(
    [a, b].map(async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))),
  );
  let diff = 0;
  for (let i = 0; i < x!.length; i++) diff |= x![i]! ^ y![i]!;
  return diff === 0;
}

export const normaliseEmail = (email: string): string => email.trim().toLowerCase();

export const looksLikeEmail = (email: string): boolean =>
  email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
