import { describe, expect, it, vi } from 'vitest';
import { fromBase64, toBase64 } from '@/core/sync/crypto';
import {
  CryptoError,
  DEFAULT_KDF,
  createKeychain,
  decryptWithPassword,
  deriveKey,
  encryptWithPassword,
  newKdfParams,
  open,
  openJson,
  parseHeader,
  randomInt,
  rewrapKeychain,
  seal,
  sealJson,
  serializeHeader,
  shuffled,
  unlockKeychain,
  wipe,
} from './index';

/** Tiny Argon2 parameters: the unit tests are about the construction, not about the cost. */
const FAST = { m: 64, t: 1, p: 1 };

async function aesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

describe('AEAD (AES-256-GCM)', () => {
  it('round-trips JSON and bytes', async () => {
    const key = await aesKey();
    const token = await sealJson(key, 'a/b', { title: 'Bank', n: [1, 2] });
    expect(await openJson(key, 'a/b', token)).toEqual({ title: 'Bank', n: [1, 2] });
    const bytes = new Uint8Array([0, 1, 254, 255]);
    expect([...(await open(key, 'x', await seal(key, 'x', bytes)))]).toEqual([0, 1, 254, 255]);
  });

  it('never reuses a nonce and gives different ciphertexts for equal plaintexts', async () => {
    const key = await aesKey();
    const tokens = await Promise.all(Array.from({ length: 200 }, () => sealJson(key, 'a', 'same')));
    expect(new Set(tokens).size).toBe(200);
    const nonces = tokens.map((t) => t.split('.')[1]);
    expect(new Set(nonces).size).toBe(200);
    expect(fromBase64(nonces[0]!).length).toBe(12);
  });

  it('rejects a wrong key, wrong AAD and any modified byte', async () => {
    const key = await aesKey();
    const token = await sealJson(key, 'vault/entry-1/1', { pw: 'geheim' });
    await expect(openJson(await aesKey(), 'vault/entry-1/1', token)).rejects.toMatchObject({
      code: 'wrong-key',
    });
    // Ciphertext moved to another record
    await expect(openJson(key, 'vault/entry-2/1', token)).rejects.toMatchObject({
      code: 'wrong-key',
    });
    const [prefix, iv, ct] = token.split('.') as [string, string, string];
    const bytes = fromBase64(ct);
    bytes[0] = bytes[0]! ^ 1;
    await expect(
      openJson(key, 'vault/entry-1/1', `${prefix}.${iv}.${toBase64(bytes)}`),
    ).rejects.toMatchObject({ code: 'wrong-key' });
    const nonce = fromBase64(iv);
    nonce[0] = nonce[0]! ^ 1;
    await expect(
      openJson(key, 'vault/entry-1/1', `${prefix}.${toBase64(nonce)}.${ct}`),
    ).rejects.toMatchObject({ code: 'wrong-key' });
  });

  it('reports malformed tokens', async () => {
    const key = await aesKey();
    for (const bad of ['', 'v2.a.b', 'v1.only', 'v1..', 'v1.@@@.@@@', 'plain text']) {
      await expect(open(key, 'a', bad)).rejects.toBeInstanceOf(CryptoError);
    }
  });
});

describe('Argon2id key derivation', () => {
  it('is deterministic per salt, differs per salt and password, and yields a non-extractable key', async () => {
    const params = newKdfParams(FAST);
    const a = await deriveKey('correct horse', params);
    expect(a.extractable).toBe(false);
    const token = await sealJson(a, 'x', 'hi');
    expect(await openJson(await deriveKey('correct horse', params), 'x', token)).toBe('hi');
    await expect(
      openJson(await deriveKey('correct horsf', params), 'x', token),
    ).rejects.toMatchObject({ code: 'wrong-key' });
    await expect(
      openJson(await deriveKey('correct horse', newKdfParams(FAST)), 'x', token),
    ).rejects.toMatchObject({ code: 'wrong-key' });
  });

  it('normalises the password (NFKC) so keyboards agree', async () => {
    const params = newKdfParams(FAST);
    const composed = await sealJson(await deriveKey('ä', params), 'x', 1);
    expect(await openJson(await deriveKey('ä', params), 'x', composed)).toBe(1);
  });

  it('refuses parameters outside the accepted range', async () => {
    const good = newKdfParams(FAST);
    for (const bad of [
      { ...good, m: 2 * 1024 * 1024 },
      { ...good, t: 99 },
      { ...good, p: 64 },
      { ...good, m: 4, p: 2 },
      { ...good, alg: 'argon2i' as 'argon2id' },
      { ...good, salt: toBase64(new Uint8Array(4)) },
    ]) {
      await expect(deriveKey('x', bad)).rejects.toBeInstanceOf(CryptoError);
    }
  });

  it('defaults to 64 MiB / 3 passes, above the OWASP floor', () => {
    expect(DEFAULT_KDF).toMatchObject({ alg: 'argon2id', m: 65536, t: 3, p: 1 });
  });
});

describe('keychain (KEK/DEK)', () => {
  it('unlocks with the right password only', async () => {
    const { header, dek } = await createKeychain('Master-Passwort 1', FAST);
    expect(dek.extractable).toBe(false);
    const token = await sealJson(dek, 'e', 'secret');
    const again = await unlockKeychain('Master-Passwort 1', header);
    expect(await openJson(again, 'e', token)).toBe('secret');
    await expect(unlockKeychain('Master-Passwort 2', header)).rejects.toMatchObject({
      code: 'wrong-key',
    });
  });

  it('is bound to the vault id (a header cannot borrow another wrapped key)', async () => {
    const a = await createKeychain('pw', FAST);
    const b = await createKeychain('pw', FAST);
    await expect(
      unlockKeychain('pw', { ...a.header, wrappedDek: b.header.wrappedDek }),
    ).rejects.toMatchObject({ code: 'wrong-key' });
  });

  it('changing the password re-wraps the same DEK: old entries stay readable', async () => {
    const { header, dek } = await createKeychain('old-pw', FAST);
    const token = await sealJson(dek, 'e', 'still here');
    const next = await rewrapKeychain('old-pw', 'new-pw', header, FAST);
    expect(next.vaultId).toBe(header.vaultId);
    expect(next.kdf.salt).not.toBe(header.kdf.salt);
    expect(await openJson(await unlockKeychain('new-pw', next), 'e', token)).toBe('still here');
    await expect(unlockKeychain('old-pw', next)).rejects.toMatchObject({ code: 'wrong-key' });
    await expect(rewrapKeychain('wrong', 'x', header, FAST)).rejects.toMatchObject({
      code: 'wrong-key',
    });
  });

  it('serialises and validates the header', async () => {
    const { header } = await createKeychain('pw', FAST);
    expect(parseHeader(serializeHeader(header))).toEqual(header);
    expect(() => parseHeader('not json')).toThrow(CryptoError);
    expect(() => parseHeader('{"v":2}')).toThrow(CryptoError);
  });

  it('never keeps the password or the DEK in the header', async () => {
    const { header } = await createKeychain('super-secret-master', FAST);
    const text = serializeHeader(header);
    expect(text).not.toContain('super-secret-master');
    expect(Object.keys(header).sort()).toEqual(['kdf', 'v', 'vaultId', 'wrappedDek']);
  });

  it('logs nothing while creating, unlocking and re-wrapping', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    try {
      const { header } = await createKeychain('never-log-me', FAST);
      await unlockKeychain('never-log-me', header);
      await unlockKeychain('wrong-never-log-me', header).catch(() => undefined);
      await rewrapKeychain('never-log-me', 'also-never-log', header, FAST);
      for (const s of spies) expect(s).not.toHaveBeenCalled();
    } finally {
      for (const s of spies) s.mockRestore();
    }
  });
});

describe('password blob (backup file)', () => {
  it('round-trips and rejects wrong password, wrong format and tampering', async () => {
    const blob = await encryptWithPassword('test-format', 'pw', 'hello ü', FAST);
    expect(JSON.stringify(blob)).not.toContain('hello');
    expect(await decryptWithPassword('test-format', 'pw', blob)).toBe('hello ü');
    await expect(decryptWithPassword('test-format', 'nope', blob)).rejects.toMatchObject({
      code: 'wrong-key',
    });
    await expect(decryptWithPassword('other', 'pw', blob)).rejects.toMatchObject({
      code: 'malformed',
    });
    await expect(
      decryptWithPassword('test-format', 'pw', { ...blob, data: blob.data.slice(0, -4) + 'AAAA' }),
    ).rejects.toBeInstanceOf(CryptoError);
    await expect(decryptWithPassword('test-format', 'pw', { nonsense: 1 })).rejects.toMatchObject({
      code: 'malformed',
    });
  });
});

describe('random helpers', () => {
  it('randomInt stays in range and is unbiased for a max that does not divide 2^32', () => {
    const max = 7;
    const counts = new Array<number>(max).fill(0);
    for (let i = 0; i < 70_000; i++) {
      const n = randomInt(max);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(max);
      counts[n]!++;
    }
    for (const c of counts) expect(c).toBeGreaterThan(9_000); // expected 10 000, ±10 %
    for (const c of counts) expect(c).toBeLessThan(11_000);
    expect(randomInt(1)).toBe(0);
    expect(() => randomInt(0)).toThrow(RangeError);
    expect(() => randomInt(1.5)).toThrow(RangeError);
  });

  it('rejects values in the biased tail instead of folding them in', () => {
    // max 3·2^30 → limit = 2^32 − (2^32 mod max) = 3·2^30; a raw value ≥ limit must be redrawn.
    const max = 3 * 2 ** 30;
    const draws = [0xffffffff, 0xc0000000, 5];
    const spy = vi.spyOn(crypto, 'getRandomValues').mockImplementation(((a: Uint32Array) => {
      a[0] = draws.shift()!;
      return a;
    }) as typeof crypto.getRandomValues);
    try {
      expect(randomInt(max)).toBe(5);
      expect(draws).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });

  it('shuffled keeps the elements and wipe zeroes bytes', () => {
    expect(shuffled([1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
    const b = new Uint8Array([1, 2, 3]);
    wipe(b);
    expect([...b]).toEqual([0, 0, 0]);
  });
});
