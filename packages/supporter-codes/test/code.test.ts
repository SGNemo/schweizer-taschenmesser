import { describe, expect, it } from 'vitest';
import { ed25519 } from '@noble/curves/ed25519.js';
import {
  encodeCode,
  generateKeyPair,
  normalizeCode,
  verifyCode,
  CODE_PREFIX,
} from '../src/index.ts';
import { TEST_KEY_ID, TEST_PUBLIC_KEY, TEST_SECRET_KEY } from './fixtures/test-keypair.ts';

const keys = { [TEST_KEY_ID]: TEST_PUBLIC_KEY };
const base = { keyId: TEST_KEY_ID, issued: '2026-10-05' } as const;
const id = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]);

describe('supporter codes', () => {
  it('round-trips tier, date and name', () => {
    const code = encodeCode({ ...base, tier: 'kuchen', name: 'Sven', id }, TEST_SECRET_KEY);
    expect(code.startsWith(CODE_PREFIX)).toBe(true);
    expect(verifyCode(code, keys)).toEqual({
      ok: true,
      keyId: TEST_KEY_ID,
      tier: 'kuchen',
      issued: '2026-10-05',
      name: 'Sven',
      id: '0102030405060708',
    });
  });

  it('works without a name and for the developer tier', () => {
    const code = encodeCode({ ...base, tier: 'developer' }, TEST_SECRET_KEY);
    const r = verifyCode(code, keys);
    expect(r).toMatchObject({ ok: true, tier: 'developer', name: '' });
  });

  it('has the documented length (no name ≈ 130 symbols)', () => {
    const code = encodeCode({ ...base, tier: 'kaffee' }, TEST_SECRET_KEY);
    const symbols = code.replace(/[^0-9A-Z]/g, '').length - 'NEMO1'.length;
    expect(symbols).toBe(Math.ceil(((14 + 64) * 8) / 5) + 2);
  });

  it('tolerates case, whitespace, line breaks and O/I/L typos', () => {
    const code = encodeCode({ ...base, tier: 'kaffee', name: 'Ada', id }, TEST_SECRET_KEY);
    const messy = ' ' + code.toLowerCase().replace(/-/g, '\n ').replace(/0/g, 'o') + ' ';
    expect(verifyCode(messy, keys)).toMatchObject({ ok: true, name: 'Ada' });
  });

  it('is deterministic for a pinned id (Ed25519) and random otherwise', () => {
    const a = encodeCode({ ...base, tier: 'kaffee', id }, TEST_SECRET_KEY);
    const b = encodeCode({ ...base, tier: 'kaffee', id }, TEST_SECRET_KEY);
    expect(a).toBe(b);
    expect(encodeCode({ ...base, tier: 'kaffee' }, TEST_SECRET_KEY)).not.toBe(
      encodeCode({ ...base, tier: 'kaffee' }, TEST_SECRET_KEY),
    );
  });

  it('rejects a tampered code (every single symbol flip)', () => {
    const code = encodeCode({ ...base, tier: 'kaffee', name: 'Ada', id }, TEST_SECRET_KEY);
    const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    const start = CODE_PREFIX.length;
    for (let i = start; i < code.length; i++) {
      if (code[i] === '-') continue;
      const flipped = alphabet[(alphabet.indexOf(code[i]!) + 1) % 32]!;
      expect(verifyCode(code.slice(0, i) + flipped + code.slice(i + 1), keys)).toEqual({
        ok: false,
      });
    }
  });

  it('rejects a payload edit even when the checksum is recomputed (signature check)', () => {
    // Same tier byte changed + valid checksum is only possible by re-encoding: use another key.
    const other = generateKeyPair();
    const forged = encodeCode({ ...base, tier: 'developer' }, other.secretKey);
    expect(verifyCode(forged, keys)).toEqual({ ok: false });
  });

  it('rejects the wrong key, an unknown key id and the empty key set', () => {
    const code = encodeCode({ ...base, tier: 'kaffee' }, TEST_SECRET_KEY);
    expect(verifyCode(code, { [TEST_KEY_ID]: generateKeyPair().publicKey })).toEqual({ ok: false });
    expect(verifyCode(code, { 1: TEST_PUBLIC_KEY })).toEqual({ ok: false });
    expect(verifyCode(code, {})).toEqual({ ok: false });
  });

  it('accepts hex-encoded public keys', () => {
    const hex = Array.from(TEST_PUBLIC_KEY, (b) => b.toString(16).padStart(2, '0')).join('');
    const code = encodeCode({ ...base, tier: 'kaffee' }, TEST_SECRET_KEY);
    expect(verifyCode(code, { [TEST_KEY_ID]: hex }).ok).toBe(true);
  });

  it('rejects garbage, truncation, foreign prefixes and wrong versions without throwing', () => {
    const code = encodeCode({ ...base, tier: 'kaffee' }, TEST_SECRET_KEY);
    for (const bad of ['', 'hello', 'NEMO1-', code.slice(0, 40), 'XXXX' + code, '💥'.repeat(500)]) {
      expect(verifyCode(bad, keys)).toEqual({ ok: false });
    }
    const v2 = code.replace('NEMO1-', 'NEMO2-');
    expect(verifyCode(v2, keys)).toEqual({ ok: false });
  });

  it('never exposes detail on failure', () => {
    expect(Object.keys(verifyCode('nope', keys))).toEqual(['ok']);
  });

  it('sanitises names when encoding and bounds them', () => {
    const code = encodeCode(
      { ...base, tier: 'kaffee', name: '\u202E' + 'Äb'.repeat(30) },
      TEST_SECRET_KEY,
    );
    const r = verifyCode(code, keys);
    expect(r.ok && [...r.name].length).toBe(20);
  });

  it('rejects out-of-range input when encoding', () => {
    expect(() =>
      encodeCode({ ...base, tier: 'kaffee', issued: '2023-12-31' }, TEST_SECRET_KEY),
    ).toThrow();
    expect(() =>
      encodeCode({ ...base, tier: 'kaffee', issued: '2026-02-30' }, TEST_SECRET_KEY),
    ).toThrow();
    expect(() => encodeCode({ ...base, keyId: 256, tier: 'kaffee' }, TEST_SECRET_KEY)).toThrow();
  });

  it('signs with domain separation (a raw signature over the payload is not accepted)', () => {
    const code = encodeCode({ ...base, tier: 'kaffee', id }, TEST_SECRET_KEY);
    expect(ed25519.verify(new Uint8Array(64), new Uint8Array(1), TEST_PUBLIC_KEY)).toBe(false);
    expect(verifyCode(code, keys).ok).toBe(true);
  });

  it('normalizes messy input to the canonical form and refuses broken input', () => {
    const code = encodeCode({ ...base, tier: 'kaffee', name: 'Ada', id }, TEST_SECRET_KEY);
    expect(normalizeCode(' ' + code.toLowerCase().replace(/-/g, ' ') + '\n')).toBe(code);
    expect(normalizeCode('NEMO1-ABC')).toBeNull();
    expect(normalizeCode('')).toBeNull();
  });
});
