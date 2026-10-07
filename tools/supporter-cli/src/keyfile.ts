import { toHex, fromHex } from '../../../packages/supporter-codes/src/index.ts';

/** Plain text key file. The secret line is the only sensitive one; nothing here is ever logged. */
const HEADER = 'nemo-supporter-key-v1';

export interface KeyFile {
  keyId: number;
  secretKey: Uint8Array;
  publicKey: Uint8Array;
}

export function formatKeyFile(k: KeyFile): string {
  return [
    HEADER,
    `keyId=${k.keyId}`,
    `public=${toHex(k.publicKey)}`,
    `secret=${toHex(k.secretKey)}`,
    '',
  ].join('\n');
}

export function parseKeyFile(text: string): KeyFile | null {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== HEADER) return null;
  const get = (name: string) => lines.find((l) => l.startsWith(name + '='))?.slice(name.length + 1);
  const keyId = Number(get('keyId'));
  const secretKey = fromHex(get('secret') ?? '');
  const publicKey = fromHex(get('public') ?? '');
  if (!Number.isInteger(keyId) || keyId < 0 || keyId > 255) return null;
  if (secretKey?.length !== 32 || publicKey?.length !== 32) return null;
  return { keyId, secretKey, publicKey };
}
