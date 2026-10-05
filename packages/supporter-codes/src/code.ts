import { ed25519 } from '@noble/curves/ed25519.js';
import { checksum, fromBase32, normaliseSymbols, toBase32 } from './base32.ts';
import { fromHex, toHex } from './hex.ts';
import { MAX_NAME_CODE_POINTS, sanitizeName } from './name.ts';

/**
 * Supporter code = `NEMO1-` + Crockford Base32 (groups of 6) of
 *   payload || signature(64) || checksum(2 symbols, over payload||signature)
 * payload = version(1) keyId(1) tier(1) issuedDay(2, BE) id(8) nameLen(1) name(UTF-8, ≤ 80)
 * The signature covers DOMAIN || payload with Ed25519. Cosmetic only: nothing is unlocked that
 * is not free anyway, so there is no expiry and no revocation list.
 */

export const CODE_VERSION = 1;
export const CODE_PREFIX = 'NEMO1-';
const DOMAIN = new TextEncoder().encode('NEMO-SUPPORTER\0');
const HEADER = 14; // version..id + nameLen
const SIG = 64;
const EPOCH_MS = Date.UTC(2024, 0, 1);
const DAY_MS = 86_400_000;
const MAX_NAME_BYTES = MAX_NAME_CODE_POINTS * 4;

export type SupporterTier = 'kaffee' | 'kuchen' | 'developer';
const TIER_BYTE: Record<SupporterTier, number> = { kaffee: 1, kuchen: 2, developer: 9 };
const BYTE_TIER = new Map<number, SupporterTier>(
  Object.entries(TIER_BYTE).map(([k, v]) => [v, k as SupporterTier]),
);

export interface KeyPair {
  secretKey: Uint8Array;
  publicKey: Uint8Array;
}

export function generateKeyPair(): KeyPair {
  const secretKey = ed25519.utils.randomSecretKey();
  return { secretKey, publicKey: ed25519.getPublicKey(secretKey) };
}

export interface CodeFields {
  keyId: number;
  tier: SupporterTier;
  /** Issue date `YYYY-MM-DD` (UTC, 2024-01-01 … ~2203). */
  issued: string;
  /** Optional display name; sanitised here. */
  name?: string;
  /** 8 random bytes; generated when omitted (tests pin it). */
  id?: Uint8Array;
}

export interface VerifiedCode {
  ok: true;
  keyId: number;
  tier: SupporterTier;
  issued: string;
  /** Empty string = no name. */
  name: string;
  /** Hex of the random id (stable per code, for deduplication only). */
  id: string;
}

export type PublicKeys = Readonly<Record<number, Uint8Array | string>>;

function dayFromIso(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new RangeError('issued must be YYYY-MM-DD');
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const day = Math.round((ms - EPOCH_MS) / DAY_MS);
  if (!Number.isFinite(day) || day < 0 || day > 0xffff || isoFromDay(day) !== iso) {
    throw new RangeError('issued out of range');
  }
  return day;
}

function isoFromDay(day: number): string {
  return new Date(EPOCH_MS + day * DAY_MS).toISOString().slice(0, 10);
}

function groupCode(symbols: string): string {
  return CODE_PREFIX + (symbols.match(/.{1,6}/g) ?? []).join('-');
}

function toBytes(key: Uint8Array | string): Uint8Array | null {
  return typeof key === 'string' ? fromHex(key) : key;
}

/** Signs and formats a code. Throws on invalid input (callers are our own tools, not users). */
export function encodeCode(fields: CodeFields, secretKey: Uint8Array): string {
  if (!Number.isInteger(fields.keyId) || fields.keyId < 0 || fields.keyId > 255) {
    throw new RangeError('keyId must be 0..255');
  }
  const name = new TextEncoder().encode(sanitizeName(fields.name ?? ''));
  const id = fields.id ?? crypto.getRandomValues(new Uint8Array(8));
  if (id.length !== 8) throw new RangeError('id must be 8 bytes');
  const day = dayFromIso(fields.issued);

  const payload = new Uint8Array(HEADER + name.length);
  payload[0] = CODE_VERSION;
  payload[1] = fields.keyId;
  payload[2] = TIER_BYTE[fields.tier];
  payload[3] = day >> 8;
  payload[4] = day & 255;
  payload.set(id, 5);
  payload[13] = name.length;
  payload.set(name, HEADER);

  const sig = ed25519.sign(concat(DOMAIN, payload), secretKey);
  const body = concat(payload, sig);
  return groupCode(toBase32(body) + checksum(body));
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

/** Structural parse only (no signature check). Null for anything malformed or mistyped. */
function parse(input: string): { payload: Uint8Array; sig: Uint8Array } | null {
  const trimmed = input.trim();
  if (trimmed.length > 400) return null;
  let symbols = normaliseSymbols(trimmed);
  const prefix = normaliseSymbols(CODE_PREFIX); // NEMO1 → normalised the same way as input
  if (!symbols.startsWith(prefix)) return null;
  symbols = symbols.slice(prefix.length);
  if (symbols.length < 3) return null;
  const body = fromBase32(symbols.slice(0, -2));
  if (!body || checksum(body) !== symbols.slice(-2)) return null;
  if (body.length < HEADER + SIG) return null;
  const payload = body.subarray(0, body.length - SIG);
  if (payload[0] !== CODE_VERSION) return null;
  const nameLen = payload[13]!;
  if (nameLen > MAX_NAME_BYTES || payload.length !== HEADER + nameLen) return null;
  return { payload, sig: body.subarray(body.length - SIG) };
}

/**
 * Canonical display form (`NEMO1-XXXXXX-…`) of a structurally valid code (right prefix, checksum
 * and layout), or null. Does not check the signature – use it to store what `verifyCode` accepted.
 */
export function normalizeCode(input: string): string | null {
  const parsed = parse(input);
  if (!parsed) return null;
  const body = concat(parsed.payload, parsed.sig);
  return groupCode(toBase32(body) + checksum(body));
}

/**
 * Verifies a code offline against the embedded public keys (by key id). Any failure – typo,
 * unknown key, tampering, wrong version – returns the same `{ ok: false }` with no detail.
 */
export function verifyCode(input: string, publicKeys: PublicKeys): VerifiedCode | { ok: false } {
  const fail = { ok: false } as const;
  try {
    const parsed = parse(input);
    if (!parsed) return fail;
    const { payload, sig } = parsed;
    const keyId = payload[1]!;
    const tier = BYTE_TIER.get(payload[2]!);
    const keyRaw = publicKeys[keyId];
    const key = keyRaw === undefined ? null : toBytes(keyRaw);
    if (!tier || !key || key.length !== 32) return fail;
    if (!ed25519.verify(sig, concat(DOMAIN, payload), key)) return fail;

    const nameBytes = payload.subarray(HEADER);
    const name = new TextDecoder('utf-8', { fatal: true }).decode(nameBytes);
    if (sanitizeName(name) !== name) return fail;
    const day = (payload[3]! << 8) | payload[4]!;
    return {
      ok: true,
      keyId,
      tier,
      issued: isoFromDay(day),
      name,
      id: toHex(payload.subarray(5, 13)),
    };
  } catch {
    return fail;
  }
}
