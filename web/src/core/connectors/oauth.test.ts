import { describe, expect, it, vi } from 'vitest';
import {
  buildAuthUrl,
  challengeOf,
  createVerifier,
  exchangeCode,
  refreshTokens,
  revokeToken,
} from './oauth';
import { ConnectorError } from './types';

const endpoints = {
  authUrl: 'https://auth.example.test/authorize',
  tokenUrl: 'https://auth.example.test/token',
  revokeUrl: 'https://auth.example.test/revoke',
  authParams: { access_type: 'offline', prompt: 'consent' },
};

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

describe('PKCE', () => {
  it('makes a URL-safe verifier of valid length and the RFC 7636 challenge', async () => {
    const v = createVerifier();
    expect(v).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    // RFC 7636 appendix B test vector.
    expect(await challengeOf('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
    expect(createVerifier()).not.toBe(v);
  });
});

describe('buildAuthUrl', () => {
  it('carries client, redirect, scopes, state and the S256 challenge', () => {
    const url = new URL(
      buildAuthUrl({
        endpoints,
        clientId: 'cid',
        redirectUri: 'http://127.0.0.1:5555/callback',
        scopes: ['a.readonly', 'b.readonly'],
        state: 'st',
        challenge: 'ch',
      }),
    );
    const q = url.searchParams;
    expect(q.get('client_id')).toBe('cid');
    expect(q.get('redirect_uri')).toBe('http://127.0.0.1:5555/callback');
    expect(q.get('response_type')).toBe('code');
    expect(q.get('scope')).toBe('a.readonly b.readonly');
    expect(q.get('state')).toBe('st');
    expect(q.get('code_challenge')).toBe('ch');
    expect(q.get('code_challenge_method')).toBe('S256');
    expect(q.get('access_type')).toBe('offline');
  });
});

describe('token requests', () => {
  it('exchanges the code (verifier, redirect, client secret in the body, never in the URL)', async () => {
    const fetchFn = vi.fn(async () =>
      json(200, { access_token: 'AT', refresh_token: 'RT', expires_in: 3599, scope: 'x' }),
    );
    const tokens = await exchangeCode(
      {
        fetch: fetchFn as unknown as typeof fetch,
        endpoints,
        clientId: 'cid',
        clientSecret: 'sec',
      },
      { code: 'the-code', verifier: 'ver', redirectUri: 'http://127.0.0.1:1/callback' },
    );
    expect(tokens).toEqual({ accessToken: 'AT', refreshToken: 'RT', expiresIn: 3599, scope: 'x' });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(endpoints.tokenUrl);
    const body = init.body as URLSearchParams;
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code_verifier')).toBe('ver');
    expect(body.get('client_secret')).toBe('sec');
  });

  it('maps invalid_grant to "expired" and 429 to "rate-limited" with the wait time', async () => {
    const client = (res: Response) => ({
      fetch: (async () => res) as typeof fetch,
      endpoints,
      clientId: 'cid',
    });
    await expect(
      refreshTokens(client(json(400, { error: 'invalid_grant' })), 'RT'),
    ).rejects.toMatchObject({
      code: 'expired',
    });
    await expect(
      refreshTokens(client(json(429, {}, { 'retry-after': '120' })), 'RT'),
    ).rejects.toMatchObject({ code: 'rate-limited', retryAfter: 120 });
    await expect(refreshTokens(client(json(200, { nothing: true })), 'RT')).rejects.toMatchObject({
      code: 'bad-response',
    });
  });

  it('keeps client data out of error messages', async () => {
    const failing = (async () => {
      throw new Error('connect ECONNREFUSED for client_secret=hunter2hunter2 and my-client-id-99');
    }) as typeof fetch;
    const err = await refreshTokens(
      { fetch: failing, endpoints, clientId: 'my-client-id-99', clientSecret: 'hunter2hunter2' },
      'RT',
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConnectorError);
    expect((err as Error).message).not.toMatch(/hunter2|my-client-id-99/);
  });
});

describe('revokeToken', () => {
  it('reports success, and never throws', async () => {
    expect(await revokeToken((async () => json(200, {})) as typeof fetch, endpoints, 'RT')).toBe(
      true,
    );
    expect(
      await revokeToken(
        (async () => {
          throw new Error('offline');
        }) as typeof fetch,
        endpoints,
        'RT',
      ),
    ).toBe(false);
    expect(await revokeToken(fetch, { ...endpoints, revokeUrl: undefined }, 'RT')).toBe(false);
  });
});
