import { fromHex } from '../../../packages/supporter-codes/src/index.ts';
import { safeEqual } from './hash.ts';
import { json, readLimited } from './http.ts';
import { issueForDonation } from './issue.ts';
import { earnsCode, parseKofiBody, parsePayload, tokenOf } from './kofi.ts';
import { log } from './log.ts';
import { handleQueue, type BatchLike } from './queue.ts';
import { handleResend, resendForm } from './resend.ts';
import { defaultDeps, type Deps, type Env } from './types.ts';

const MAX_BODY = 16 * 1024;

const TEXT_SETTINGS = [
  'KOFI_VERIFICATION_TOKEN',
  'SUPPORTER_SIGNING_KEY',
  'RESEND_API_KEY',
  'HASH_PEPPER',
  'OWNER_EMAIL',
  'SIGNING_KEY_ID',
  'MAIL_FROM',
] as const;

/**
 * Secrets piped in with `wrangler secret put` (PowerShell, Windows) can carry a trailing line
 * break; stray whitespace must never make a valid token or key fail.
 */
export function cleanEnv(env: Env): Env {
  const out: Env = { ...env };
  for (const key of TEXT_SETTINGS) {
    const value = out[key] as unknown;
    if (typeof value === 'string') out[key] = value.trim();
  }
  if (typeof out.REPLY_TO === 'string') out.REPLY_TO = out.REPLY_TO.trim();
  return out;
}

function misconfigured(env: Env): string | null {
  const missing = (
    [
      'KOFI_VERIFICATION_TOKEN',
      'SUPPORTER_SIGNING_KEY',
      'RESEND_API_KEY',
      'HASH_PEPPER',
      'OWNER_EMAIL',
      'SIGNING_KEY_ID',
      'MAIL_FROM',
    ] as const
  ).filter((k) => !env[k]);
  if (missing.length) return missing.join(',');
  if (fromHex(env.SUPPORTER_SIGNING_KEY)?.length !== 32) return 'SUPPORTER_SIGNING_KEY';
  return null;
}

async function limited(request: Request, env: Env, route: string): Promise<boolean> {
  if (!env.RATE_LIMITER) return false;
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  return !(await env.RATE_LIMITER.limit({ key: `${route}:${ip}` })).success;
}

async function handleKofi(request: Request, env: Env, deps: Deps): Promise<Response> {
  const body = await readLimited(request, MAX_BODY);
  if (body === null) return json(413, { ok: false });

  // 1) Authenticity first: without the right token nothing else happens.
  const raw = parseKofiBody(body);
  const token = tokenOf(raw);
  if (token === null || !(await safeEqual(token, env.KOFI_VERIFICATION_TOKEN))) {
    log('webhook', { result: 'unauthorised', status: 401 });
    return json(401, { ok: false });
  }

  const payload = parsePayload(raw);
  if (!payload) {
    log('webhook', { result: 'bad-payload', status: 400 });
    return json(400, { ok: false });
  }
  // 2) Only a successful donation earns a code; everything else is acknowledged and ignored.
  if (!earnsCode(payload)) {
    log('webhook', { result: 'ignored', status: 200 });
    return json(200, { ok: true, ignored: true });
  }

  const issued = await issueForDonation(env, deps, payload);
  if (!issued.ok) {
    log('webhook', { result: issued.reason, status: issued.reason === 'amount' ? 200 : 500 });
    // A bad amount is acknowledged (a retry would not help); a broken setup must be noticed.
    return issued.reason === 'amount'
      ? json(200, { ok: true, ignored: true })
      : json(500, { ok: false });
  }
  return json(200, { ok: true });
}

export async function handleFetch(
  request: Request,
  rawEnv: Env,
  deps: Deps = defaultDeps,
): Promise<Response> {
  const env = cleanEnv(rawEnv);
  const { pathname } = new URL(request.url);

  if (pathname === '/health') {
    return request.method === 'GET'
      ? json(200, { ok: true })
      : json(405, { ok: false }, { allow: 'GET' });
  }

  const route = pathname === '/kofi' ? 'kofi' : pathname === '/resend' ? 'resend' : null;
  if (!route) return json(404, { ok: false });

  const allowed = route === 'kofi' ? ['POST'] : ['GET', 'POST'];
  if (!allowed.includes(request.method))
    return json(405, { ok: false }, { allow: allowed.join(', ') });

  const broken = misconfigured(env);
  if (broken) {
    log('webhook', { result: 'misconfigured', reason: broken, status: 500 });
    return json(500, { ok: false });
  }
  if (await limited(request, env, route)) return json(429, { ok: false }, { 'retry-after': '60' });

  if (route === 'kofi') return handleKofi(request, env, deps);
  return request.method === 'GET' ? resendForm() : handleResend(request, env);
}

export default {
  fetch: (request: Request, env: Env) => handleFetch(request, env),
  queue: (batch: BatchLike, env: Env) => handleQueue(batch, cleanEnv(env), defaultDeps),
};
