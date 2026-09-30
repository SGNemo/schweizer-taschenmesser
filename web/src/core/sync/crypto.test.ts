import { describe, expect, it } from 'vitest';
import {
  decryptOps,
  decryptValue,
  deriveKey,
  encryptOps,
  encryptValue,
  fromBase64,
  isEncrypted,
  makeVaultCheck,
  newSalt,
  toBase64,
  verifyVaultCheck,
} from './crypto';
import type { FieldOp } from './types';

// Few iterations keep the tests fast; production uses 600 000 (PBKDF2_ITERATIONS).
const ITER = 1000;
const salt = newSalt();
const key = () => deriveKey('correct horse battery staple', salt, ITER);

const op = (over: Partial<FieldOp> = {}): FieldOp => ({
  collection: 'todos_task',
  id: 'r1',
  field: 'title',
  hlc: '1700000000000-0000-aaaa0001',
  value: 'Steuererklärung 🧾',
  ...over,
});

describe('encoding helpers', () => {
  it('round-trips bytes through base64 and creates distinct salts', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    expect([...fromBase64(toBase64(bytes))]).toEqual([...bytes]);
    expect(newSalt()).not.toBe(newSalt());
    expect(fromBase64(newSalt())).toHaveLength(16);
  });
});

describe('value encryption', () => {
  it('round-trips any JSON value including null, unicode and objects', async () => {
    const k = await key();
    for (const v of [null, 0, false, '', 'Übung 🎉', [1, { a: 2 }], { nested: { x: null } }]) {
      const c = await encryptValue(k, 'a/b/c', v);
      expect(isEncrypted(c)).toBe(true);
      expect(await decryptValue(k, 'a/b/c', c)).toEqual(v);
    }
  });

  it('uses a fresh IV every time and never leaks the plaintext', async () => {
    const k = await key();
    const a = await encryptValue(k, 'x', 'secret-title');
    const b = await encryptValue(k, 'x', 'secret-title');
    expect(a).not.toBe(b);
    expect(a).not.toContain('secret-title');
    expect(atob(a.split(':')[3]!)).not.toContain('secret');
  });

  it('fails with a wrong passphrase, a different salt, a different location or tampered data', async () => {
    const k = await key();
    const c = await encryptValue(k, 'loc/1/f', 'value');
    await expect(
      decryptValue(await deriveKey('wrong passphrase', salt, ITER), 'loc/1/f', c),
    ).rejects.toMatchObject({ code: 'decrypt' });
    await expect(
      decryptValue(await deriveKey('correct horse battery staple', newSalt(), ITER), 'loc/1/f', c),
    ).rejects.toThrow();
    await expect(decryptValue(k, 'loc/2/f', c)).rejects.toThrow(); // moved to another record
    const parts = c.split(':');
    parts[3] = toBase64(fromBase64(parts[3]!).map((b, i) => (i === 0 ? b ^ 1 : b)));
    await expect(decryptValue(k, 'loc/1/f', parts.join(':'))).rejects.toThrow();
    await expect(decryptValue(k, 'loc/1/f', 'enc:v1:onlyone')).rejects.toThrow();
  });

  it('derives the same key for the same passphrase and salt on another device', async () => {
    const c = await encryptValue(await key(), 'a', 'hello');
    expect(await decryptValue(await key(), 'a', c)).toBe('hello');
  });
});

describe('vault check', () => {
  it('verifies the right passphrase and rejects wrong ones and garbage', async () => {
    const check = await makeVaultCheck(await key());
    expect(await verifyVaultCheck(await key(), check)).toBe(true);
    expect(await verifyVaultCheck(await deriveKey('nope nope nope', salt, ITER), check)).toBe(
      false,
    );
    expect(await verifyVaultCheck(await key(), 'plain text')).toBe(false);
    expect(await verifyVaultCheck(await key(), 'enc:v1:xx:yy')).toBe(false);
  });
});

describe('op encryption', () => {
  it('encrypts only values; collection, id, field and hlc stay readable', async () => {
    const [enc] = await encryptOps(await key(), [op()]);
    expect(enc).toMatchObject({
      collection: 'todos_task',
      id: 'r1',
      field: 'title',
      hlc: op().hlc,
    });
    expect(isEncrypted(enc!.value)).toBe(true);
    expect((await decryptOps(await key(), [enc!])).ops).toEqual([op()]);
  });

  it('drops plaintext, foreign and swapped ops instead of applying them', async () => {
    const k = await key();
    const good = (await encryptOps(k, [op({ id: 'r1' })]))[0]!;
    const swapped = { ...good, id: 'r2' }; // ciphertext of r1 presented as r2
    const plain = op({ id: 'r3' });
    const other = (
      await encryptOps(await deriveKey('other passphrase', salt, ITER), [op({ id: 'r4' })])
    )[0]!;
    const result = await decryptOps(k, [good, swapped, plain, other]);
    expect(result.ops.map((o) => o.id)).toEqual(['r1']);
    expect(result.rejected).toBe(3);
  });
});
