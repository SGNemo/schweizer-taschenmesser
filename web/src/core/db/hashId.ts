/**
 * A deterministic id from its parts (SHA-256, hex): the same parts give the same id on every device, so
 * a second save of the same thing finds the first instead of doubling it. A record id travels in clear
 * through sync – the hash keeps what the parts say (refs, module names) out of it. `bytes` picks the
 * length: 8 → 16 characters (quick capture), 32 → the full 64 (link rows).
 */
export async function hashId(parts: readonly string[], bytes = 32): Promise<string> {
  const data = new TextEncoder().encode(parts.join('\u0000'));
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return Array.from(hash.slice(0, bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}
