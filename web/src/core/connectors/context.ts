/** Builds the `ConnectorContext` a connector works with: platform fetch, tokens, secrets, redaction. */
import { getPlatform } from '@/core/platform';
import { fetchPublic as publicFetch, PublicFetchError } from '@/core/net/fetchPublic';
import { refreshTokens } from './oauth';
import { redactWith } from './redact';
import { ConnectorError, type ConnectorContext, type ConnectorDef } from './types';

export const secretName = (id: string, name: string) => `oauth:${id}:${name}`;
export const connectorSecret = (id: string, name: string) => `connector:${id}:${name}`;

/** Access tokens live in memory only (they expire within an hour anyway). */
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export function forgetAccessToken(id: string): void {
  tokenCache.delete(id);
}

export async function loadClient(id: string) {
  const { secrets } = getPlatform();
  return {
    clientId: await secrets.get(secretName(id, 'client-id')),
    clientSecret: await secrets.get(secretName(id, 'client-secret')),
    refreshToken: await secrets.get(secretName(id, 'refresh')),
  };
}

export function createContext(def: ConnectorDef, now: () => number = Date.now): ConnectorContext {
  const platform = getPlatform();
  const literals: (string | undefined)[] = [];
  const redact = (text: string) => redactWith(text, literals);

  async function accessToken(): Promise<string> {
    const cached = tokenCache.get(def.id);
    if (cached && cached.expiresAt - 60_000 > now()) return cached.token;
    if (!def.oauth) throw new ConnectorError('unsupported', 'no oauth');
    const { clientId, clientSecret, refreshToken } = await loadClient(def.id);
    literals.push(clientId, clientSecret, refreshToken);
    if (!clientId || !refreshToken) throw new ConnectorError('expired', 'not signed in');
    const tokens = await refreshTokens(
      { fetch: platform.fetch, endpoints: def.oauth, clientId, clientSecret },
      refreshToken,
    );
    tokenCache.set(def.id, {
      token: tokens.accessToken,
      expiresAt: now() + tokens.expiresIn * 1000,
    });
    // Google may rotate the refresh token; keep the newest one.
    if (tokens.refreshToken && tokens.refreshToken !== refreshToken)
      await platform.secrets.set(secretName(def.id, 'refresh'), tokens.refreshToken);
    return tokens.accessToken;
  }

  async function fetchPublic(url: string, init?: RequestInit): Promise<Response> {
    try {
      return await publicFetch(url, init);
    } catch (e) {
      if (e instanceof PublicFetchError)
        throw new ConnectorError(
          e.code,
          e.code === 'no-proxy' ? 'no sync server' : redact(e.message),
        );
      throw e;
    }
  }

  return {
    fetch: platform.fetch,
    accessToken,
    fetchPublic,
    secrets: {
      get: (name) => platform.secrets.get(connectorSecret(def.id, name)),
      set: (name, value) => platform.secrets.set(connectorSecret(def.id, name), value),
      delete: (name) => platform.secrets.delete(connectorSecret(def.id, name)),
    },
    redact,
  };
}
