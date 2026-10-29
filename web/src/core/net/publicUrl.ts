/**
 * What counts as a public feed address on the client. The sync server's proxy applies the same idea
 * after DNS resolution (`server/src/proxy.ts`); the app cannot resolve names, so it only judges the
 * text: https, no credentials, and a host that is not loopback, private, link-local (cloud
 * metadata) or a local-only name. A host name that *resolves* to a private address is stopped by
 * the proxy in the browser; on the desktop it is a known limit (see `docs/security`).
 */
const LOCAL_SUFFIXES = ['.local', '.localhost', '.internal', '.lan', '.home', '.corp', '.intranet'];

function privateV4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

/** `host` comes from `URL.hostname` (lower case, IPv6 in brackets, IPv4 in dotted form). */
export function isPublicHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  if (!h || h.startsWith('[')) return false; // IPv6 literals are never a calendar service
  if (privateV4(h)) return false;
  if (/^[\d.]+$/.test(h)) return /^(\d{1,3}\.){3}\d{1,3}$/.test(h); // odd numeric forms are refused
  if (!h.includes('.')) return false; // "localhost", "nas", …
  return !LOCAL_SUFFIXES.some((s) => h.endsWith(s));
}

export function isPublicHttpsUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return (
      url.protocol === 'https:' && !url.username && !url.password && isPublicHost(url.hostname)
    );
  } catch {
    return false;
  }
}
