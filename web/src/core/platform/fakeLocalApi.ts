/**
 * E2E stand-in for the desktop shell's loopback server (`src-tauri/crates/local-api`), which a
 * browser test cannot start. It mirrors the token check (SHA-256 of the bearer token against the
 * registered hashes, expiry) and hands the request to the same app handler; transport checks
 * (Host, Origin, sizes, rate limits) are covered by the Rust tests. Only wired up when the app is
 * built with `--mode e2e` (see `web.ts`); tests call `window.__tmLocalApi.request(...)`.
 */
import type { LocalApiRequest, LocalApiServerToken, LocalApiService } from './types';

interface FakeCall {
  method: string;
  path: string;
  query?: string;
  body?: unknown;
  token?: string;
  idempotencyKey?: string;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function createFakeLocalApi(): LocalApiService {
  let tokens: LocalApiServerToken[] = [];
  let handler: ((req: LocalApiRequest) => Promise<{ status: number; body: string }>) | null = null;
  let nextId = 1;

  const request = async (call: FakeCall): Promise<{ status: number; body: unknown }> => {
    if (!handler) return { status: 0, body: null }; // nothing listens
    const hash = call.token ? await sha256Hex(call.token) : '';
    const entry = tokens.find((t) => t.hash === hash);
    if (!entry) return { status: 401, body: { error: 'token-invalid' } };
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now())
      return { status: 401, body: { error: 'token-expired' } };
    const reply = await handler({
      id: nextId++,
      tokenId: entry.id,
      method: call.method,
      path: call.path,
      query: call.query ?? '',
      idempotencyKey: call.idempotencyKey ?? null,
      body: call.body === undefined ? null : JSON.stringify(call.body),
    });
    return { status: reply.status, body: JSON.parse(reply.body) as unknown };
  };

  return {
    supported: true,
    async start(port, list, onRequest) {
      tokens = list;
      handler = onRequest;
      (window as unknown as { __tmLocalApi?: unknown }).__tmLocalApi = { request, port };
      return port;
    },
    async setTokens(list) {
      tokens = list;
    },
    async stop() {
      handler = null;
    },
  };
}
