export type UrlKind = 'https' | 'http' | 'other';

export function urlKind(url: string): UrlKind {
  try {
    const p = new URL(url).protocol;
    return p === 'https:' ? 'https' : p === 'http:' ? 'http' : 'other';
  } catch {
    return 'other';
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/** Short form for lists and the tab strip: host + path without scheme, `www.` and trailing slash. */
export function displayUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === '/' ? '' : u.pathname;
    return `${u.hostname.replace(/^www\./, '')}${path}`;
  } catch {
    return url;
  }
}

/** Only http(s) addresses may be stored or handed to other modules. */
export function isWebUrl(url: string): boolean {
  return urlKind(url) !== 'other';
}
