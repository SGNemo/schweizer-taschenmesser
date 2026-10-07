export type Base64Mode = 'b64-enc' | 'b64-dec' | 'url-enc' | 'url-dec';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

export function toBase64(text: string): string {
  let binary = '';
  for (const b of encoder.encode(text)) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** Accepts standard and URL-safe alphabets, with or without padding and whitespace. */
export function fromBase64(input: string): string {
  const clean = input.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) throw new Error('invalid base64');
  const padded = clean.padEnd(Math.ceil(clean.length / 4) * 4, '=');
  const binary = atob(padded);
  return decoder.decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

/** Runs a conversion; undefined when the input is not valid for it. */
export function convertText(mode: Base64Mode, input: string): string | undefined {
  try {
    switch (mode) {
      case 'b64-enc':
        return toBase64(input);
      case 'b64-dec':
        return fromBase64(input);
      case 'url-enc':
        return encodeURIComponent(input);
      case 'url-dec':
        return decodeURIComponent(input);
    }
  } catch {
    return undefined;
  }
}
