/** What the address bar does with typed text: open an address or search. Pure, mirrors `browser_filter::classify`. */
export type OmniResult = { kind: 'url' | 'search'; url: string };

const HOST_LIKE = /^(localhost|(\d{1,3}\.){3}\d{1,3}|([a-z0-9-]+\.)+[a-z]{2,})(:\d+)?([/?#].*)?$/i;

export function resolveInput(input: string, searchTemplate: string): OmniResult | null {
  const text = input.trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) {
    try {
      return { kind: 'url', url: new URL(text).href };
    } catch {
      /* fall through to search */
    }
  } else if (!/\s/.test(text) && HOST_LIKE.test(text)) {
    try {
      return { kind: 'url', url: new URL(`https://${text}`).href };
    } catch {
      /* fall through to search */
    }
  }
  // Everything else (also `javascript:`, `file:`, `data:` …) is just search text, never an address.
  return { kind: 'search', url: searchTemplate.replace('{q}', encodeURIComponent(text)) };
}
