/**
 * The unsubscribe link of a newsletter (`List-Unsubscribe`, RFC 2369): only an `https:` address is
 * offered, and only to open in the browser after the user confirmed. Nemo never calls it by itself, never
 * sends the `mailto:` variant and never uses one-click POST (RFC 8058): unsubscribing stays the user's act
 * on the sender's own page.
 */
const MAX = 2000;

export function unsubscribeUrl(header: string | undefined): string | undefined {
  if (!header) return undefined;
  for (const match of header.matchAll(/<([^>]+)>/g)) {
    const raw = match[1]!.trim();
    if (raw.length > MAX) continue;
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      continue;
    }
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) continue;
    return url.href;
  }
  return undefined;
}
