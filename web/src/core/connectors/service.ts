/**
 * Connector lifecycle: login, disconnect, calendar sync and mail scan, plus the background loop.
 * Everything a connector returns is plain data; it goes into the modules through their manifest
 * contributions (`externalCalendar`), never through connector code.
 */
import { loadModuleStates } from '@/core/modules/activation';
import { activeManifests } from '@/core/modules/contributions';
import type { ExternalCalendarSink } from '@/core/modules/types';
import { getPlatform } from '@/core/platform';
import { now } from '@/core/time/now';
import { addDaysStr, today } from '@/core/time/dates';
import { createContext, forgetAccessToken, loadClient, secretName } from './context';
import {
  buildAuthUrl,
  challengeOf,
  createVerifier,
  exchangeCode,
  randomToken,
  revokeToken,
} from './oauth';
import { getConnector, connectors } from './registry';
import { redact } from './redact';
import {
  clearStatus,
  deleteLocalPrefix,
  getLocal,
  loadStatus,
  saveStatus,
  setLocal,
} from './state';
import {
  ConnectorError,
  type ConnectorDef,
  type ConnectorStatus,
  type ExternalCalendar,
  type MailScanResult,
} from './types';

const MIN = 60_000;
/** Full-sync window: a little history, a year ahead. */
const WINDOW_PAST_DAYS = 60;
const WINDOW_FUTURE_DAYS = 400;

const syncKey = (id: string, calendarId: string) => `connector.${id}.sync.${calendarId}`;
const selectedKey = (id: string) => `connector.${id}.calendars`;
const calendarsKey = (id: string) => `connector.${id}.calendarList`;

/* ---------------------------------- sink lookup ---------------------------------- */

/** The calendar module's sink, or undefined when that module is off (then nothing is stored). */
export async function getCalendarSink(): Promise<ExternalCalendarSink | undefined> {
  const manifests = activeManifests(await loadModuleStates());
  const load = manifests.find((m) => m.contributions?.externalCalendar)?.contributions
    ?.externalCalendar;
  return load ? (await load()).default : undefined;
}

/* ------------------------------------ error text ----------------------------------- */

/** German text of a failure for the settings card; never contains a secret. */
export function describeError(e: unknown): string {
  const code = e instanceof ConnectorError ? e.code : 'network';
  const texts: Record<string, string> = {
    expired: 'Die Verbindung ist abgelaufen. Bitte melde dich neu an.',
    'rate-limited': 'Der Dienst hat zu viele Anfragen gemeldet. Es wird später erneut versucht.',
    'not-configured': 'Es fehlen noch Zugangsdaten.',
    'no-proxy':
      'Im Browser braucht dieser Abruf den Sync-Server (Einstellungen → Synchronisierung).',
    network: 'Der Dienst ist gerade nicht erreichbar.',
    denied: 'Die Anmeldung wurde abgebrochen oder abgelehnt.',
    'bad-response': 'Der Dienst hat eine unerwartete Antwort geschickt.',
    unsupported: 'Das geht auf diesem Gerät nicht.',
  };
  return texts[code] ?? redact(String(e));
}

/* ------------------------------------- login -------------------------------------- */

export async function saveClient(
  id: string,
  client: { clientId: string; clientSecret?: string },
): Promise<void> {
  const { secrets } = getPlatform();
  await secrets.set(secretName(id, 'client-id'), client.clientId.trim());
  if (client.clientSecret?.trim())
    await secrets.set(secretName(id, 'client-secret'), client.clientSecret.trim());
  else await secrets.delete(secretName(id, 'client-secret'));
  forgetAccessToken(id);
}

export async function hasClient(id: string): Promise<boolean> {
  return Boolean((await loadClient(id)).clientId);
}

/** Opens the system browser for the login and stores the refresh token. */
export async function connectOAuth(
  def: ConnectorDef,
  featureIds: string[],
  opts: { signal?: AbortSignal } = {},
): Promise<ConnectorStatus> {
  const platform = getPlatform();
  const { signal } = opts;
  try {
    if (!def.oauth || !platform.oauth.supported) throw new ConnectorError('unsupported');
    const { clientId, clientSecret } = await loadClient(def.id);
    if (!clientId) throw new ConnectorError('not-configured');
    const features = def.features.filter((f) => featureIds.includes(f.id));
    if (features.length === 0) throw new ConnectorError('not-configured');
    const scopes = [...new Set(features.flatMap((f) => f.scopes))];

    const verifier = createVerifier();
    const state = randomToken(24);
    const { redirectUri, wait } = await platform.oauth.start();
    if (signal?.aborted) return await loadStatus(def.id);
    await platform.app.openUrl(
      buildAuthUrl({
        endpoints: def.oauth,
        clientId,
        redirectUri,
        scopes,
        state,
        challenge: await challengeOf(verifier),
      }),
    );
    let code: string;
    try {
      // An abandoned login (the caller aborted): stop waiting and touch nothing – no token is
      // exchanged and no status is written. The one-shot loopback listener times out on its own.
      const waiting = wait(state);
      waiting.catch(() => undefined);
      const outcome = await new Promise<{ code: string } | 'aborted'>((resolve, reject) => {
        if (signal?.aborted) return resolve('aborted');
        signal?.addEventListener('abort', () => resolve('aborted'), { once: true });
        waiting.then(resolve, reject);
      });
      if (outcome === 'aborted') return await loadStatus(def.id);
      ({ code } = outcome);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new ConnectorError(message.startsWith('denied') ? 'denied' : 'network', 'login');
    }
    if (signal?.aborted) return await loadStatus(def.id);
    const tokens = await exchangeCode(
      { fetch: platform.fetch, endpoints: def.oauth, clientId, clientSecret },
      { code, verifier, redirectUri },
    );
    if (!tokens.refreshToken) throw new ConnectorError('bad-response', 'no refresh token');
    // Tokens are stored only for a login that was carried through to the end.
    if (signal?.aborted) return await loadStatus(def.id);
    await platform.secrets.set(secretName(def.id, 'refresh'), tokens.refreshToken);
    forgetAccessToken(def.id);
    return await saveStatus(def.id, {
      state: 'connected',
      features: features.map((f) => f.id),
      message: undefined,
      retryAt: undefined,
    });
  } catch (e) {
    return await saveStatus(def.id, {
      state: e instanceof ConnectorError && e.code === 'denied' ? 'disconnected' : 'error',
      message: describeError(e),
    });
  }
}

/** Revokes the token and forgets everything device-local. `keepData` keeps the copied events. */
export async function disconnect(def: ConnectorDef, opts: { keepData: boolean }): Promise<void> {
  const platform = getPlatform();
  const refresh = await platform.secrets.get(secretName(def.id, 'refresh'));
  if (refresh && def.oauth) await revokeToken(platform.fetch, def.oauth, refresh);
  await platform.secrets.delete(secretName(def.id, 'refresh'));
  forgetAccessToken(def.id);
  await deleteLocalPrefix(`connector.${def.id}.`);
  await clearStatus(def.id);
  if (!opts.keepData) await (await getCalendarSink())?.clear(def.id);
}

/* -------------------------------- calendar sync ---------------------------------- */

export async function listCalendars(def: ConnectorDef): Promise<ExternalCalendar[]> {
  if (!def.calendar) return [];
  const previous = await storedCalendars(def.id);
  const list = await def.calendar.listCalendars(createContext(def));
  await setLocal(calendarsKey(def.id), list);
  // A calendar that no longer exists at the source (removed subscription, deleted calendar) takes
  // its copied events with it.
  const gone = previous.filter((p) => !list.some((c) => c.id === p.id));
  if (gone.length > 0) {
    const sink = await getCalendarSink();
    for (const g of gone) {
      await sink?.clear(def.id, g.id);
      await setLocal(syncKey(def.id, g.id), undefined);
    }
  }
  return list;
}

export async function storedCalendars(id: string): Promise<ExternalCalendar[]> {
  return (await getLocal<ExternalCalendar[]>(calendarsKey(id))) ?? [];
}

export async function selectedCalendarIds(id: string): Promise<string[] | undefined> {
  return getLocal<string[]>(selectedKey(id));
}

export async function selectCalendars(def: ConnectorDef, ids: string[]): Promise<void> {
  const before = (await selectedCalendarIds(def.id)) ?? [];
  await setLocal(selectedKey(def.id), ids);
  // A calendar that was switched off loses its copied events and its sync token.
  const sink = await getCalendarSink();
  for (const removed of before.filter((c) => !ids.includes(c))) {
    await sink?.clear(def.id, removed);
    await setLocal(syncKey(def.id, removed), undefined);
  }
}

export interface SyncOutcome {
  added: number;
  updated: number;
  removed: number;
}

/** Syncs every selected calendar of a connector into the calendar module. */
export async function syncCalendars(def: ConnectorDef): Promise<SyncOutcome> {
  const total: SyncOutcome = { added: 0, updated: 0, removed: 0 };
  const capability = def.calendar;
  if (!capability) return total;
  const status = await loadStatus(def.id);
  if (status.retryAt && status.retryAt > now()) return total; // still backing off
  const sink = await getCalendarSink();
  if (!sink) return total;

  try {
    const ctx = createContext(def);
    const known = await listCalendars(def);
    // Connectors without a login (ICS subscriptions) sync everything the user added.
    let selected =
      def.authType === 'none' ? known.map((c) => c.id) : await selectedCalendarIds(def.id);
    if (!selected) {
      selected = known.filter((c) => c.primary).map((c) => c.id);
      if (selected.length === 0 && known[0]) selected = [known[0].id];
      await setLocal(selectedKey(def.id), selected);
    }
    const day = today();
    for (const calendarId of selected.filter((id) => known.some((c) => c.id === id))) {
      const info = known.find((c) => c.id === calendarId)!;
      const result = await capability.sync(ctx, {
        calendarId,
        syncToken: await getLocal<string>(syncKey(def.id, calendarId)),
        from: addDaysStr(day, -WINDOW_PAST_DAYS),
        to: addDaysStr(day, WINDOW_FUTURE_DAYS),
      });
      const applied = await sink.apply({
        source: def.id,
        calendarId,
        color: info.color,
        upsert: result.events,
        removeExtIds: result.removedIds,
        replaceAll: result.full,
      });
      total.added += applied.added;
      total.updated += applied.updated;
      total.removed += applied.removed;
      await setLocal(syncKey(def.id, calendarId), result.nextSyncToken);
    }
    await saveStatus(def.id, {
      state: 'connected',
      lastSyncAt: now(),
      message: undefined,
      retryAt: undefined,
    });
  } catch (e) {
    await saveStatus(def.id, failureStatus(e));
  }
  return total;
}

function failureStatus(e: unknown): Partial<ConnectorStatus> {
  if (e instanceof ConnectorError && e.code === 'expired')
    return { state: 'expired', message: describeError(e) };
  if (e instanceof ConnectorError && e.code === 'rate-limited') {
    const wait = Math.min(Math.max(e.retryAfter ?? 300, 60), 3600);
    return { state: 'rate-limited', message: describeError(e), retryAt: now() + wait * 1000 };
  }
  return { state: 'error', message: describeError(e) };
}

/* ------------------------------------ mail scan ---------------------------------- */

/** Reads message headers of the last `months` months and returns suggestions (nothing is stored). */
export async function scanMail(
  def: ConnectorDef,
  months: number,
  onProgress?: (done: number, total: number) => void,
): Promise<MailScanResult> {
  if (!def.mail) return { findings: [], read: 0 };
  try {
    const result = await def.mail.scan(createContext(def), {
      months,
      today: today(),
      onProgress,
    });
    await saveStatus(def.id, { state: 'connected', message: undefined });
    return result;
  } catch (e) {
    await saveStatus(def.id, failureStatus(e));
    throw e;
  }
}

/* -------------------------------- background loop --------------------------------- */

const INTERVAL = 30 * MIN;

/** Should this connector sync in the background now? */
async function due(def: ConnectorDef): Promise<boolean> {
  if (!def.calendar) return false;
  const s = await loadStatus(def.id);
  if (def.authType === 'oauth-pkce' && !s.features.includes('calendar')) return false;
  if (s.state === 'disconnected' || s.state === 'expired') return false;
  if (s.retryAt && s.retryAt > now()) return false;
  return !s.lastSyncAt || now() - s.lastSyncAt >= INTERVAL - MIN;
}

export async function syncDueConnectors(): Promise<void> {
  for (const def of connectors) if (await due(def)) await syncCalendars(def);
}

/** Starts the loop (start, every 5 min while visible, when returning to the app). Returns a stopper. */
export function startConnectorSync(): () => void {
  const run = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    void syncDueConnectors().catch(() => undefined);
  };
  const first = setTimeout(run, 5_000);
  const timer = setInterval(run, 5 * MIN);
  document.addEventListener('visibilitychange', run);
  return () => {
    clearTimeout(first);
    clearInterval(timer);
    document.removeEventListener('visibilitychange', run);
  };
}

export { getConnector };
