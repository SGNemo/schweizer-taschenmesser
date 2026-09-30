/**
 * Self-contained password encryption for exports (vault backup file): Argon2id + AES-256-GCM.
 * Independent of the vault's own master password and of sync.
 */
import { z } from 'zod';
import { open, seal } from './aead';
import { CryptoError } from './errors';
import { assertKdfParams, deriveKey, newKdfParams, type KdfParams } from './kdf';

const AAD = 'taschenmesser/password-blob/v1';

const blobSchema = z.object({
  format: z.string(),
  v: z.literal(1),
  kdf: z.object({
    alg: z.literal('argon2id'),
    m: z.number(),
    t: z.number(),
    p: z.number(),
    salt: z.string(),
  }),
  data: z.string(),
});

export interface PasswordBlob {
  format: string;
  v: 1;
  kdf: KdfParams;
  data: string;
}

export async function encryptWithPassword(
  format: string,
  password: string,
  plaintext: string,
  kdf: { m?: number; t?: number; p?: number } = {},
): Promise<PasswordBlob> {
  const params = newKdfParams(kdf);
  const key = await deriveKey(password, params);
  return {
    format,
    v: 1,
    kdf: params,
    data: await seal(key, `${AAD}/${format}`, new TextEncoder().encode(plaintext)),
  };
}

/** Wrong password or modified file → `CryptoError('wrong-key')`. */
export async function decryptWithPassword(
  format: string,
  password: string,
  input: unknown,
): Promise<string> {
  const parsed = blobSchema.safeParse(input);
  if (!parsed.success || parsed.data.format !== format) throw new CryptoError('malformed');
  assertKdfParams(parsed.data.kdf);
  const key = await deriveKey(password, parsed.data.kdf);
  return new TextDecoder().decode(await open(key, `${AAD}/${format}`, parsed.data.data));
}
