/**
 * `GET /v1/proxy?url=…`: fetches a public calendar/feed URL on behalf of the PWA, which cannot do it
 * itself (browsers block cross-origin requests to most calendar and news hosts).
 *
 * A proxy that fetches arbitrary URLs is an SSRF hazard, so it is deliberately narrow:
 *  - only http/https, no credentials in the URL, only ports 80/443/8080/8443;
 *  - every hop resolves the host first and refuses loopback, private, link-local (cloud metadata),
 *    CGNAT, unique-local, multicast and reserved addresses – if *any* answer is blocked, all are;
 *  - the connection is pinned to the address that was checked (no second DNS lookup, so DNS
 *    rebinding cannot swap it), TLS keeps the original host name;
 *  - redirects are followed by hand (≤ 3), each hop is checked again;
 *  - at most 2 MB, 10 s, and only feed-like content types come back.
 */
import { lookup as dnsLookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';

export const MAX_PROXY_BYTES = 2 * 1024 * 1024;
export const PROXY_TIMEOUT_MS = 10_000;
export const MAX_REDIRECTS = 3;
const ALLOWED_PORTS = new Set([80, 443, 8080, 8443]);

export type ProxyErrorCode =
  | 'invalid-url'
  | 'blocked'
  | 'unsupported-type'
  | 'too-large'
  | 'too-many-redirects'
  | 'timeout'
  | 'upstream-error';

export class ProxyError extends Error {
  constructor(readonly code: ProxyErrorCode) {
    super(code);
  }
}

/* ------------------------------ address classification ------------------------------ */

function ipv4ToInt(ip: string): number | undefined {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255))
    return undefined;
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

const V4_BLOCKS: [string, number][] = [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8],
  ['100.64.0.0', 10], // CGNAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, incl. the cloud metadata address 169.254.169.254
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved + broadcast
];

function blockedV4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === undefined) return true; // unparsable = refuse
  return V4_BLOCKS.some(([base, bits]) => {
    const b = ipv4ToInt(base)!;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (n & mask) >>> 0 === (b & mask) >>> 0;
  });
}

/** Expands an IPv6 text address into eight 16-bit groups (handles `::` and an embedded IPv4 tail). */
function groupsV6(ip: string): number[] | undefined {
  let text = ip.toLowerCase().split('%')[0]!; // zone id
  const tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (tail) {
    const v4 = ipv4ToInt(tail[1]!);
    if (v4 === undefined) return undefined;
    text = `${text.slice(0, -tail[1]!.length)}${((v4 >>> 16) & 0xffff).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }
  const halves = text.split('::');
  if (halves.length > 2) return undefined;
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const fill = halves.length === 2 ? 8 - head.length - rest.length : 0;
  if (fill < 0 || (halves.length === 1 && head.length !== 8)) return undefined;
  const all = [...head, ...Array<string>(fill).fill('0'), ...rest].map((g) => parseInt(g, 16));
  return all.length === 8 && all.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff)
    ? all
    : undefined;
}

function blockedV6(ip: string): boolean {
  const g = groupsV6(ip);
  if (!g) return true;
  const embeddedV4 = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  if (g.every((x) => x === 0)) return true; // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1
  if (g[0]! >= 0xfe80 && g[0]! <= 0xfebf) return true; // fe80::/10 link-local
  if ((g[0]! & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g[0]! & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentation
  if (g[0] === 0x0100 && g[1] === 0 && g[2] === 0 && g[3] === 0) return true; // discard 100::/64
  // IPv4-mapped (::ffff:a.b.c.d), IPv4-compatible and NAT64 (64:ff9b::/96): judge the embedded IPv4.
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0))
    return blockedV4(embeddedV4(g[6]!, g[7]!));
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0))
    return blockedV4(embeddedV4(g[6]!, g[7]!));
  if (g[0] === 0x2002) return blockedV4(embeddedV4(g[1]!, g[2]!)); // 6to4
  return false;
}

/** True for every address a proxy must never connect to. */
export function isBlockedAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return blockedV4(ip);
  if (version === 6) return blockedV6(ip);
  return true;
}

/* ------------------------------------- fetching ------------------------------------- */

export interface UpstreamResponse {
  status: number;
  headers: Record<string, string | undefined>;
  body: Buffer;
}

export interface ProxyDeps {
  /** All addresses of a host name. */
  resolve(host: string): Promise<string[]>;
  /** One request to an already checked address. Must not follow redirects or do its own DNS. */
  fetch(args: {
    url: URL;
    address: string;
    headers: Record<string, string>;
    timeoutMs: number;
    maxBytes: number;
  }): Promise<UpstreamResponse>;
}

export const defaultDeps: ProxyDeps = {
  async resolve(host) {
    const answers = await dnsLookup(host, { all: true, verbatim: true });
    return answers.map((a) => a.address);
  },
  fetch({ url, address, headers, timeoutMs, maxBytes }) {
    return new Promise((resolve, reject) => {
      const client = url.protocol === 'https:' ? https : http;
      const family = isIP(address);
      const req = client.request(
        url,
        {
          method: 'GET',
          headers,
          timeout: timeoutMs,
          // The connection goes to the address we checked; there is no second lookup to poison.
          lookup: (_host, options, callback) => {
            // Node asks for a list when "happy eyeballs" is on, for one address otherwise.
            if ((options as { all?: boolean }).all)
              (callback as (e: null, a: { address: string; family: number }[]) => void)(null, [
                { address, family },
              ]);
            else (callback as (e: null, a: string, f: number) => void)(null, address, family);
          },
          servername: isIP(url.hostname) ? undefined : url.hostname,
        },
        (res) => {
          const chunks: Buffer[] = [];
          let size = 0;
          res.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > maxBytes) {
              req.destroy();
              reject(new ProxyError('too-large'));
              return;
            }
            chunks.push(chunk);
          });
          res.on('end', () =>
            resolve({
              status: res.statusCode ?? 502,
              headers: Object.fromEntries(
                Object.entries(res.headers).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
              ),
              body: Buffer.concat(chunks),
            }),
          );
          res.on('error', () => reject(new ProxyError('upstream-error')));
        },
      );
      req.on('timeout', () => {
        req.destroy();
        reject(new ProxyError('timeout'));
      });
      req.on('error', (e) =>
        reject(e instanceof ProxyError ? e : new ProxyError('upstream-error')),
      );
      req.end();
    });
  },
};

/* ------------------------------------ the request ------------------------------------ */

/** Feed-like types only: never HTML, script, images or JSON. */
const TYPE_ALLOWED =
  /^(text\/(calendar|plain|xml|x-vcalendar|x-ical)|application\/(xml|ics|x-ics|calendar|(rss|atom|rdf)\+xml))$/i;

export function checkUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ProxyError('invalid-url');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new ProxyError('invalid-url');
  if (url.username || url.password) throw new ProxyError('invalid-url');
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  if (!ALLOWED_PORTS.has(port)) throw new ProxyError('invalid-url');
  return url;
}

/** Resolves and validates the host; returns the address to connect to. */
async function checkedAddress(url: URL, deps: ProxyDeps): Promise<string> {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [host] : await deps.resolve(host).catch(() => []);
  if (addresses.length === 0) throw new ProxyError('upstream-error');
  if (addresses.some(isBlockedAddress)) throw new ProxyError('blocked');
  return addresses[0]!;
}

export interface ProxyResult {
  status: number;
  contentType?: string;
  etag?: string;
  lastModified?: string;
  body: Buffer;
}

export async function proxyFetch(
  input: string,
  conditional: { ifNoneMatch?: string; ifModifiedSince?: string },
  deps: ProxyDeps = defaultDeps,
): Promise<ProxyResult> {
  let url = checkUrl(input);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const address = await checkedAddress(url, deps);
    const headers: Record<string, string> = {
      'user-agent': 'Taschenmesser-Proxy/1',
      accept:
        'text/calendar, application/rss+xml, application/atom+xml, application/xml, text/xml, text/plain;q=0.5',
      'accept-encoding': 'identity',
      host: url.host,
    };
    if (conditional.ifNoneMatch) headers['if-none-match'] = conditional.ifNoneMatch;
    if (conditional.ifModifiedSince) headers['if-modified-since'] = conditional.ifModifiedSince;

    const res = await deps.fetch({
      url,
      address,
      headers,
      timeoutMs: PROXY_TIMEOUT_MS,
      maxBytes: MAX_PROXY_BYTES,
    });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.location;
      if (!location) throw new ProxyError('upstream-error');
      // Relative locations resolve against the current URL; the next hop is checked from scratch.
      url = checkUrl(new URL(location, url).toString());
      continue;
    }
    if (res.status === 304) {
      return {
        status: 304,
        etag: res.headers.etag,
        lastModified: res.headers['last-modified'],
        body: Buffer.alloc(0),
      };
    }
    if (res.status < 200 || res.status >= 300) throw new ProxyError('upstream-error');
    const type = (res.headers['content-type'] ?? '').split(';')[0]!.trim();
    if (!TYPE_ALLOWED.test(type)) throw new ProxyError('unsupported-type');
    if (res.body.length > MAX_PROXY_BYTES) throw new ProxyError('too-large');
    return {
      status: 200,
      contentType: res.headers['content-type'],
      etag: res.headers.etag,
      lastModified: res.headers['last-modified'],
      body: res.body,
    };
  }
  throw new ProxyError('too-many-redirects');
}
