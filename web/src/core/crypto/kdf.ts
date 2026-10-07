/**
 * Password → key with Argon2id (`hash-wasm`, the reference implementation compiled to WASM).
 * The raw KDF output only exists inside `deriveKey`: it is imported as a **non-extractable**
 * AES-GCM key and overwritten right away.
 */
import { argon2id } from 'hash-wasm';
import { fromBase64, toBase64 } from '@/core/sync/crypto';
import { CryptoError } from './errors';
import { randomBytes, wipe } from './random';

export interface KdfParams {
  alg: 'argon2id';
  /** Memory in KiB. */
  m: number;
  /** Iterations (passes). */
  t: number;
  /** Parallelism (lanes). */
  p: number;
  /** base64, 16 random bytes. */
  salt: string;
}

/**
 * Defaults (OWASP "high memory" class, stronger than its minimum 19 MiB / t = 2): 64 MiB, t = 3.
 * They are stored in every header, so they can be raised later without breaking old data.
 */
export const DEFAULT_KDF = { alg: 'argon2id', m: 64 * 1024, t: 3, p: 1 } as const;

/** Headers weaker than this are refused (protects against a downgrade through a tampered header). */
export const KDF_FLOOR = { m: 19 * 1024, t: 2, p: 1 } as const;
/**
 * Upper bounds so that a header that arrived through sync or an import file cannot make the device
 * allocate gigabytes or spin for minutes (256 MiB keeps a phone's WASM heap intact).
 */
export const KDF_CEILING = { m: 256 * 1024, t: 10, p: 4 } as const;

/**
 * Unit tests run with tiny parameters (Argon2 at 64 MiB would take seconds per call). Both flags are
 * required so that no production bundle can ever carry the bypass (`DEV` is false in every build).
 */
const weakAllowed = import.meta.env.MODE === 'test' && import.meta.env.DEV === true;

/** `atob` throws a `DOMException` on bad input; callers only expect `CryptoError`. */
export function decodeSalt(salt: string): Uint8Array<ArrayBuffer> {
  try {
    return fromBase64(salt);
  } catch {
    throw new CryptoError('malformed', 'salt is not base64');
  }
}

export function newKdfParams(overrides: Partial<Pick<KdfParams, 'm' | 't' | 'p'>> = {}): KdfParams {
  const params: KdfParams = {
    ...DEFAULT_KDF,
    ...overrides,
    salt: toBase64(randomBytes(16)),
  };
  assertKdfParams(params);
  return params;
}

export function assertKdfParams(p: KdfParams): void {
  const ints = [p.m, p.t, p.p].every((n) => Number.isInteger(n));
  if (p.alg !== 'argon2id' || !ints) throw new CryptoError('malformed', 'unsupported KDF');
  if (
    p.p < 1 ||
    p.p > KDF_CEILING.p ||
    p.t < 1 ||
    p.t > KDF_CEILING.t ||
    p.m < 8 * p.p ||
    p.m > KDF_CEILING.m
  ) {
    throw new CryptoError('unsafe-params', 'KDF parameters out of range');
  }
  if (!weakAllowed && (p.m < KDF_FLOOR.m || p.t < KDF_FLOOR.t)) {
    throw new CryptoError('unsafe-params', 'KDF parameters too weak');
  }
  if (decodeSalt(p.salt).length < 16) throw new CryptoError('malformed', 'salt too short');
}

/** NFKC so that the same password typed on different keyboards/OSes derives the same key. */
const passwordBytes = (password: string) => new TextEncoder().encode(password.normalize('NFKC'));

export async function deriveKey(
  password: string,
  params: KdfParams,
  usages: KeyUsage[] = ['encrypt', 'decrypt'],
): Promise<CryptoKey> {
  assertKdfParams(params);
  const raw = await argon2id({
    password: passwordBytes(password),
    salt: decodeSalt(params.salt),
    parallelism: params.p,
    iterations: params.t,
    memorySize: params.m,
    hashLength: 32,
    outputType: 'binary',
  });
  try {
    return await crypto.subtle.importKey(
      'raw',
      raw as Uint8Array<ArrayBuffer>,
      'AES-GCM',
      false,
      usages,
    );
  } finally {
    wipe(raw);
  }
}
