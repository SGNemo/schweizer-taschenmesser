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
  return { url: text, host: parsed.hostname };
}
