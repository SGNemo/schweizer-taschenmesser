/**
 * Origin matching for credential offers. A credential is only ever offered to a page whose origin
 * matches the stored URL: same scheme, same port, and either the same host or (mode `domain`) the
 * same registrable domain. Hosts are normalised through the WHATWG URL parser (IDN → punycode).
 */
import { getDomain } from 'tldts';

export type OriginMatchMode = 'domain' | 'host';

export interface NormalizedOrigin {
  scheme: 'http' | 'https';
  /** Lower-case ASCII host (punycode), without trailing dot; IPv6 keeps its brackets. */
  host: string;
  port: number;
}

const DEFAULT_PORT = { http: 80, https: 443 } as const;

/**
 * Parses a page origin or a stored URL. A missing scheme means https (stored URLs are often typed
 * as `example.com`). Anything but http(s) returns null.
 */
export function normalizeOrigin(input: string): NormalizedOrigin | null {
  const raw = input.trim();
  if (raw === '' || raw.length > 2048) return null;
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^[^/?#]*:\d+(?:[/?#]|$)/.test(raw);
  let url: URL;
  try {
    url = new URL(hasScheme ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const host = url.hostname.replace(/\.$/, '').toLowerCase();
  if (host === '') return null;
  const scheme = url.protocol === 'https:' ? 'https' : 'http';
  return { scheme, host, port: url.port === '' ? DEFAULT_PORT[scheme] : Number(url.port) };
}

const isIp = (host: string): boolean =>
  host.startsWith('[') || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);

/** Registrable domain (eTLD+1, private suffixes such as `github.io` count as suffixes) or null. */
export function registrableDomain(host: string): string | null {
  if (isIp(host)) return null;
  return getDomain(host, { allowPrivateDomains: true });
}

/** Serialised form used in messages: `https://host[:port]` (default ports left out). */
export function originString(o: NormalizedOrigin): string {
  const port = o.port === DEFAULT_PORT[o.scheme] ? '' : `:${o.port}`;
  return `${o.scheme}://${o.host}${port}`;
}

export function matchesOrigin(
  storedUrl: string,
  pageOrigin: string,
  mode: OriginMatchMode = 'domain',
): boolean {
  const a = normalizeOrigin(storedUrl);
  const b = normalizeOrigin(pageOrigin);
  if (!a || !b) return false;
  if (a.scheme !== b.scheme || a.port !== b.port) return false;
  if (a.host === b.host) return true;
  if (mode === 'host') return false;
  const da = registrableDomain(a.host);
  const db = registrableDomain(b.host);
  return da !== null && da === db;
}
