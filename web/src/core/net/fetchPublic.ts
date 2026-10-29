/**
 * Fetches a *public* URL (calendar or news feed). The native app asks the host directly (no CORS);
 * the browser cannot, so it goes through the sync server's `/v1/proxy` – without a sync server there
 * is no way and `PublicFetchError('no-proxy')` says so.
 *
 * The native branch applies the same two limits the server proxy enforces (`server/src/proxy.ts`):
 * at most 2 MB and only feed-like content types. A violation comes back as the proxy would answer
 * it – HTTP 413 / 415 with `{ error }` – so callers see one shape on both paths.
 */
import { getPlatform } from '@/core/platform';
import { isPublicHttpsUrl } from './publicUrl';
import { loadSyncConfig } from '@/core/sync/service';

export class PublicFetchError extends Error {
  constructor(
    readonly code: 'no-proxy' | 'network' | 'timeout',
    message: string = code,
  ) {
    super(message);
    this.name = 'PublicFetchError';
  }
}

/** A feed that does not answer must end in an error, never in an endless "Wird geprüft …". */
export const PUBLIC_FETCH_TIMEOUT_MS = 20_000;

/** Same number as `MAX_PROXY_BYTES` in `server/src/proxy.ts` (not imported: no shared package). */
export const MAX_PUBLIC_BYTES = 2 * 1024 * 1024;

/** Mirrors `TYPE_ALLOWED` of the server proxy, plus `application/octet-stream` for `.ics` downloads. */
const TYPE_ALLOWED =
  /^(text\/(calendar|plain|xml|x-vcalendar|x-ical)|application\/(xml|ics|x-ics|calendar|octet-stream|(rss|atom|rdf)\+xml))$/i;

const proxyStyleError = (code: 'unsupported-type' | 'too-large'): Response =>
  new Response(JSON.stringify({ error: code }), {
    status: code === 'too-large' ? 413 : 415,
    headers: { 'content-type': 'application/json' },
  });

/** Reads at most `maxBytes`; `undefined` when the body is longer. */
async function readCapped(res: Response, maxBytes: number): Promise<ArrayBuffer | undefined> {
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) return undefined;
  const reader = res.body?.getReader?.();
  if (!reader) {
    const bytes = await res.arrayBuffer();
    return bytes.byteLength > maxBytes ? undefined : bytes;
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return undefined;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out.buffer;
}

/** Applies the proxy's type and size limits to a successful native response. */
export async function limitPublicResponse(res: Response): Promise<Response> {
  if (!res.ok) return res; // errors, 304 … pass through; callers never read those bodies
  const type = (res.headers.get('content-type') ?? '').split(';')[0]!.trim();
  if (!TYPE_ALLOWED.test(type)) return proxyStyleError('unsupported-type');
  const body = await readCapped(res, MAX_PUBLIC_BYTES);
  if (!body) return proxyStyleError('too-large');
  return new Response(body, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}

/** Races a request against the timeout; the abort also stops the body read inside the caller's `res`. */
async function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await Promise.race([
      run(controller.signal),
      new Promise<never>((_, reject) =>
        controller.signal.addEventListener('abort', () =>
          reject(new PublicFetchError('timeout', 'timeout')),
        ),
      ),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

const asNetworkError = (e: unknown): PublicFetchError =>
  e instanceof PublicFetchError
    ? e
    : new PublicFetchError('network', e instanceof Error ? e.message : String(e));

export async function fetchPublic(
  url: string,
  init?: RequestInit,
  timeoutMs = PUBLIC_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const platform = getPlatform();
  if (platform.isNative) {
    // The desktop app asks the host itself, so the address rules the proxy would apply are checked here.
    if (!isPublicHttpsUrl(url)) throw new PublicFetchError('network', 'not a public https address');
    try {
      return await withTimeout(
        async (signal) => limitPublicResponse(await platform.fetch(url, { ...init, signal })),
        timeoutMs,
      );
    } catch (e) {
      throw asNetworkError(e);
    }
  }
  const config = await loadSyncConfig();
  if (!config) throw new PublicFetchError('no-proxy');
  const proxied = `${config.url.replace(/\/+$/, '')}/v1/proxy?url=${encodeURIComponent(url)}`;
  const headers = new Headers(init?.headers);
  headers.set('authorization', `Bearer ${config.token}`);
  try {
    return await withTimeout((signal) => fetch(proxied, { ...init, headers, signal }), timeoutMs);
  } catch (e) {
    throw asNetworkError(e);
  }
}
