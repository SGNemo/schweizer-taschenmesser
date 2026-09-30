/** Minimal client for the app's local API. Every request goes to the configured loopback origin. */
import type { Config } from './config.js';

export const MODULE_RE = /^[a-z][a-z0-9]*$/;
export const BATCH_RE = /^[a-z0-9]{1,40}$/;
const TIMEOUT_MS = 35_000;

export interface ApiResponse {
  status: number;
  body: unknown;
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  idempotencyKey?: string;
}

export type Api = (method: string, path: string, opts?: RequestOptions) => Promise<ApiResponse>;

export function createApi(config: Config, fetchFn: typeof fetch = fetch): Api {
  return async (method, path, opts = {}) => {
    const url = new URL(path, config.baseUrl);
    // Defence in depth: the path is built from checked parts, but never leave the configured origin.
    if (url.origin !== config.baseUrl) throw new Error('refused: other origin');
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    const headers: Record<string, string> = { Authorization: `Bearer ${config.token}` };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;
    let res: Response;
    try {
      res = await fetchFn(url, {
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        // A redirect would carry the token elsewhere; the app never redirects.
        redirect: 'error',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      return {
        status: 0,
        body: {
          error: 'unreachable',
          message:
            'Die App ist nicht erreichbar. Läuft die Windows-App und ist unter Einstellungen → KI-Zugriff die Schnittstelle eingeschaltet?',
        },
      };
    }
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // Keep the raw text.
    }
    return { status: res.status, body };
  };
}
