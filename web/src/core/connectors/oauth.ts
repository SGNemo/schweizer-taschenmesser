/**
 * OAuth 2.0 authorization-code flow with PKCE for the installed-app case (RFC 7636 / RFC 8252):
 * the system browser does the login, the redirect lands on a one-shot loopback port
 * (`PlatformService.oauth`), and the token exchange goes through `PlatformService.fetch`.
 * Pure helpers here; storage and UI live in `service.ts`.
 */
import { redactWith } from './redact';
import { ConnectorError, type OAuthEndpoints } from './types';

const b64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');

export function randomToken(byteLength = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

/** PKCE code verifier: 43–128 URL-safe characters (64 random bytes → 86). */
export const createVerifier = (): string => randomToken(64);

export async function challengeOf(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}

export function buildAuthUrl(args: {
  endpoints: OAuthEndpoints;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
  challenge: string;
}): string {
  const url = new URL(args.endpoints.authUrl);
  const q = url.searchParams;
  q.set('client_id', args.clientId);
  q.set('redirect_uri', args.redirectUri);
  q.set('response_type', 'code');
  q.set('scope', args.scopes.join(' '));
  q.set('state', args.state);
  q.set('code_challenge', args.challenge);
  q.set('code_challenge_method', 'S256');
  for (const [k, v] of Object.entries(args.endpoints.authParams ?? {})) q.set(k, v);
  return url.toString();
}

export interface Tokens {
  accessToken: string;
  refreshToken?: string;
  /** Seconds. */
  expiresIn: number;
  scope?: string;
}

interface TokenClient {
  fetch: typeof fetch;
  endpoints: OAuthEndpoints;
  clientId: string;
  clientSecret?: string;
}

function retryAfterSeconds(res: Response): number | undefined {
  const header = res.headers.get('retry-after');
  const n = header ? Number(header) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

async function tokenRequest(client: TokenClient, params: Record<string, string>): Promise<Tokens> {
  const body = new URLSearchParams({ client_id: client.clientId, ...params });
  if (client.clientSecret) body.set('client_secret', client.clientSecret);
  let res: Response;
  try {
    res = await client.fetch(client.endpoints.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch (e) {
    throw new ConnectorError(
      'network',
      redactWith(String(e), [client.clientId, client.clientSecret]),
    );
  }
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    // Non-JSON error page: handled by the status checks below.
  }
  if (res.status === 429)
    throw new ConnectorError('rate-limited', 'rate-limited', retryAfterSeconds(res));
  if (!res.ok) {
    const error = typeof json.error === 'string' ? json.error : `http ${res.status}`;
    // invalid_grant = revoked, expired (7-day limit of unverified "testing" apps) or reused token.
    if (error === 'invalid_grant') throw new ConnectorError('expired', error);
    if (error === 'access_denied') throw new ConnectorError('denied', error);
    throw new ConnectorError(
      res.status >= 500 ? 'network' : 'bad-response',
      redactWith(`token endpoint: ${error}`, [client.clientId, client.clientSecret]),
    );
  }
  const accessToken = json.access_token;
  if (typeof accessToken !== 'string' || !accessToken)
    throw new ConnectorError('bad-response', 'token endpoint: no access_token');
  return {
    accessToken,
    refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : undefined,
    expiresIn: typeof json.expires_in === 'number' ? json.expires_in : 3600,
    scope: typeof json.scope === 'string' ? json.scope : undefined,
  };
}

export function exchangeCode(
  client: TokenClient,
  args: { code: string; verifier: string; redirectUri: string },
): Promise<Tokens> {
  return tokenRequest(client, {
    grant_type: 'authorization_code',
    code: args.code,
    code_verifier: args.verifier,
    redirect_uri: args.redirectUri,
  });
}

export function refreshTokens(client: TokenClient, refreshToken: string): Promise<Tokens> {
  return tokenRequest(client, { grant_type: 'refresh_token', refresh_token: refreshToken });
}

/** Best effort: tells the provider to invalidate the token. Never throws. */
export async function revokeToken(
  fetchFn: typeof fetch,
  endpoints: OAuthEndpoints,
  token: string,
): Promise<boolean> {
  if (!endpoints.revokeUrl) return false;
  try {
    const res = await fetchFn(endpoints.revokeUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
