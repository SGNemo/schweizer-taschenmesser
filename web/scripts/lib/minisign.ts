/**
 * Verifies a minisign signature (the format `tauri signer sign` writes) with Node's crypto only, so CI
 * can check the signed files before anything is published. Erasable TypeScript.
 *
 * Both inputs are what the Tauri config and `latest.json` carry: the base64 of the minisign text.
 * Signature algorithm `ED` = Ed25519 over the BLAKE2b-512 hash of the file (what Tauri produces),
 * `Ed` = legacy, over the raw file.
 */
import { createHash, createPublicKey, verify } from 'node:crypto';

const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

const b64Text = (input: string): string => Buffer.from(input.trim(), 'base64').toString('utf8');

/** The base64 payload line (second line) of a minisign public key or signature text. */
function payload(text: string): Buffer {
  const line = text.split(/\r?\n/).filter((l) => l.trim() !== '')[1];
  if (!line) throw new Error('Not a minisign file: payload line missing');
  return Buffer.from(line.trim(), 'base64');
}

export interface MinisignKey {
  keyId: string;
  raw: Buffer;
}

export function parsePublicKey(pubkeyB64: string): MinisignKey {
  const bytes = payload(b64Text(pubkeyB64));
  if (bytes.length !== 42 || bytes.subarray(0, 2).toString('latin1') !== 'Ed') {
    throw new Error('Not a minisign Ed25519 public key');
  }
  return { keyId: bytes.subarray(2, 10).toString('hex'), raw: bytes.subarray(10) };
}

/** Throws unless `data` carries a valid signature of the given key. */
export function verifyMinisign(data: Buffer, signatureB64: string, pubkeyB64: string): void {
  const key = parsePublicKey(pubkeyB64);
  const sig = payload(b64Text(signatureB64));
  if (sig.length !== 74) throw new Error('Not a minisign signature');
  const algorithm = sig.subarray(0, 2).toString('latin1');
  if (algorithm !== 'ED' && algorithm !== 'Ed')
    throw new Error(`Unknown signature algorithm ${algorithm}`);
  if (sig.subarray(2, 10).toString('hex') !== key.keyId) {
    throw new Error('Signature was made with a different key (key id mismatch)');
  }
  const message = algorithm === 'ED' ? createHash('blake2b512').update(data).digest() : data;
  const publicKey = createPublicKey({
    key: Buffer.concat([SPKI_ED25519_PREFIX, key.raw]),
    format: 'der',
    type: 'spki',
  });
  if (!verify(null, message, publicKey, sig.subarray(10))) {
    throw new Error('Signature does not match the file');
  }
}
