import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parsePublicKey, verifyMinisign } from './minisign';

// A throw-away key made for the test only: nothing here is a real secret.
function fixture(data: Buffer, algorithm: 'ED' | 'Ed' = 'ED') {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  const keyId = Buffer.from('0123456789abcdef', 'hex');
  const pubText = `untrusted comment: test key\n${Buffer.concat([Buffer.from('Ed'), keyId, raw]).toString('base64')}\n`;
  const message = algorithm === 'ED' ? createHash('blake2b512').update(data).digest() : data;
  const signature = sign(null, message, privateKey);
  const sigText = `untrusted comment: signature\n${Buffer.concat([Buffer.from(algorithm), keyId, signature]).toString('base64')}\ntrusted comment: t\nAAAA\n`;
  return {
    pubkey: Buffer.from(pubText).toString('base64'),
    sig: Buffer.from(sigText).toString('base64'),
  };
}

describe('verifyMinisign', () => {
  const data = Buffer.from('MZ-pretend-executable');

  it('accepts a valid prehashed signature and a legacy one', () => {
    for (const alg of ['ED', 'Ed'] as const) {
      const f = fixture(data, alg);
      expect(() => verifyMinisign(data, f.sig, f.pubkey)).not.toThrow();
    }
  });

  it('rejects changed data', () => {
    const f = fixture(data);
    expect(() => verifyMinisign(Buffer.from('MZ-other'), f.sig, f.pubkey)).toThrow(
      /does not match/,
    );
  });

  it('rejects another key', () => {
    const a = fixture(data);
    const b = fixture(data);
    expect(() => verifyMinisign(data, a.sig, b.pubkey)).toThrow();
  });

  it('rejects garbage', () => {
    expect(() => parsePublicKey('Zm9v')).toThrow();
    const f = fixture(data);
    expect(() => verifyMinisign(data, 'Zm9v', f.pubkey)).toThrow();
  });

  it('reads the key id', () => {
    expect(parsePublicKey(fixture(data).pubkey).keyId).toBe('0123456789abcdef');
  });
});
