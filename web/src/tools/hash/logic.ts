export type HashAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-512';
export const ALGORITHMS: HashAlgorithm[] = ['SHA-256', 'SHA-1', 'SHA-512'];

/** Hex digest of the UTF-8 bytes of `text` (WebCrypto; SHA-1 is offered for checksums only). */
export async function digestHex(algorithm: HashAlgorithm, text: string): Promise<string> {
  const buffer = await crypto.subtle.digest(algorithm, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}
