/**
 * A plain web address a person shared (planner hub 2, package 1; CONCEPT-INTAKE idea 1, LAUNCH-REVIEW B9): only
 * `http:` / `https:`, at most `WEB_ADDRESS_MAX` characters, no user info, a host. Checked where it is read, drawn and
 * opened – the same gate each time. Nothing here fetches anything.
 */

/** Longest address that is kept (a longer one is shown, never stored). */
export const WEB_ADDRESS_MAX = 2048;

/** The address and its host (`URL.hostname`: punycode for a non-ASCII host), or `undefined` when it is not one. */
export function webAddress(raw: string | undefined): { url: string; host: string } | undefined {
  const text = raw?.trim() ?? '';
  if (!text || text.length > WEB_ADDRESS_MAX || /\s/.test(text)) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
  if (parsed.username || parsed.password || !parsed.hostname) return undefined;
  // The stored form is what counts: a non-ASCII path grows when URL encodes it.
  if (parsed.href.length > WEB_ADDRESS_MAX) return undefined;
  // One form for storing, drawing and opening: the address as URL reads it, so what is shown is what opens.
  return { url: parsed.href, host: parsed.hostname };
}

/**
 * An address found in running text without the punctuation that ends its sentence („…/a.“, „…/a)“); a closing „)“ stays
 * when the address opens one itself (`…/Foo_(bar)`).
 */
export function trimTrailing(raw: string): string {
  let out = raw.replace(/[.,;:!?]+$/, '');
  while (out.endsWith(')') && (out.match(/\(/g)?.length ?? 0) < (out.match(/\)/g)?.length ?? 0)) {
    out = out.slice(0, -1).replace(/[.,;:!?]+$/, '');
  }
  return out;
}

/** Every address-like token of a line, as the capture parser finds them (`http(s)://…`, `www.…`, any case). */
export const ADDRESS_TOKENS = /(?:https?:\/\/|www\.)\S+/gi;
