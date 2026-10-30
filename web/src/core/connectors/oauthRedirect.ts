/**
 * Browser (PWA) login for providers that accept an https redirect to the app's own address (Spotify):
 * the same PKCE flow as the desktop login, but the system browser is the app itself. `begin` stores the
 * verifier and `state` in `sessionStorage` (this tab only, never synced) and leaves for the provider;
 * the provider returns to `/oauth/callback`, where `finish` checks `state`, exchanges the code and stores
 * the refresh token exactly like `connectOAuth`. The user registers `<app address>/oauth/callback` at the
 * provider. No token ever sits in the address bar or in storage beyond the pending login.
 */
import { z } from 'zod';
import { getPlatform } from '@/core/platform';
import { now } from '@/core/time/now';
import { forgetAccessToken, loadClient, secretName } from './context';
import { buildAuthUrl, challengeOf, createVerifier, exchangeCode, randomToken } from './oauth';
import { redirectUri } from './redirect';
import { describeError } from './service';
import { saveStatus } from './state';
import { getConnector } from './registry';
import { ConnectorError, type ConnectorDef } from './types';

export { REDIRECT_PATH, redirectUri } from './redirect';
export const PENDING_KEY = 'tm-oauth-pending';
/** A login that is not finished within this time is dropped. */
const PENDING_MS = 10 * 60_000;

const pendingSchema = z.object({
  connector: z.string(),
  state: z.string().min(16),
  verifier: z.string().min(43),
  redirectUri: z.string(),
  features: z.array(z.string()),
  at: z.number(),
});
type Pending = z.infer<typeof pendingSchema>;

/**
 * Providers only accept https redirects (and the numeric loopback address), so the browser login is
 * offered on an https page, on 127.0.0.1, and in the E2E build. The platform must be a plain browser.
 */
export function browserLoginAvailable(def: ConnectorDef): boolean {
  if (!def.oauth?.browserLogin || getPlatform().kind !== 'web') return false;
  return (
    location.protocol === 'https:' ||
    location.hostname === '127.0.0.1' ||
    import.meta.env.MODE === 'e2e'
  );
}

function readPending(): Pending | undefined {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY); // one use, whatever comes next
    if (!raw) return undefined;
    const parsed = pendingSchema.safeParse(JSON.parse(raw));
    return parsed.success && now() - parsed.data.at < PENDING_MS ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/** Leaves for the provider's login page. `go` is injectable for tests. */
export async function beginBrowserLogin(
  def: ConnectorDef,
  featureIds: string[],
  go: (url: string) => void = (url) => location.assign(url),
): Promise<void> {
  try {
    if (!def.oauth || !browserLoginAvailable(def)) throw new ConnectorError('unsupported');
    const { clientId } = await loadClient(def.id);
    if (!clientId) throw new ConnectorError('not-configured');
    const features = def.features.filter((f) => featureIds.includes(f.id));
    if (features.length === 0) throw new ConnectorError('not-configured');
    const verifier = createVerifier();
    const state = randomToken(24);
    const pending: Pending = {
      connector: def.id,
      state,
      verifier,
      redirectUri: redirectUri(),
      features: features.map((f) => f.id),
      at: now(),
    };
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    go(
      buildAuthUrl({
        endpoints: def.oauth,
        clientId,
        redirectUri: pending.redirectUri,
        scopes: [...new Set(features.flatMap((f) => f.scopes))],
        state,
        challenge: await challengeOf(verifier),
      }),
    );
  } catch (e) {
    await saveStatus(def.id, { state: 'error', message: describeError(e) });
  }
}

export type FinishOutcome = 'connected' | 'denied' | 'error' | 'ignored';

const inflight = new Map<string, Promise<FinishOutcome>>();

/** Completes the login from the query string of `/oauth/callback`. Safe to call twice (StrictMode). */
export function finishBrowserLogin(search: string): Promise<FinishOutcome> {
  const existing = inflight.get(search);
  if (existing) return existing;
  const run = complete(search);
  inflight.set(search, run);
  return run;
}

async function complete(search: string): Promise<FinishOutcome> {
  const params = new URLSearchParams(search);
  const pending = readPending();
  // Someone opened the address by hand, an old tab, or a forged link: nothing happens.
  if (!pending || params.get('state') !== pending.state) return 'ignored';
  const def = getConnector(pending.connector);
  if (!def?.oauth) return 'ignored';
  try {
    if (params.get('error')) {
      await saveStatus(def.id, { state: 'disconnected', message: undefined });
      return 'denied';
    }
    const code = params.get('code');
    if (!code) throw new ConnectorError('bad-response', 'no code');
    const platform = getPlatform();
    const { clientId, clientSecret } = await loadClient(def.id);
    if (!clientId) throw new ConnectorError('not-configured');
    const tokens = await exchangeCode(
      { fetch: platform.fetch, endpoints: def.oauth, clientId, clientSecret },
      { code, verifier: pending.verifier, redirectUri: pending.redirectUri },
    );
    if (!tokens.refreshToken) throw new ConnectorError('bad-response', 'no refresh token');
    await platform.secrets.set(secretName(def.id, 'refresh'), tokens.refreshToken);
    forgetAccessToken(def.id);
    await saveStatus(def.id, {
      state: 'connected',
      features: pending.features,
      message: undefined,
      retryAt: undefined,
    });
    return 'connected';
  } catch (e) {
    await saveStatus(def.id, { state: 'error', message: describeError(e) });
    return 'error';
  }
}
