/**
 * The service worker's brain, separated from the chrome.* wiring so it can be tested. It owns the
 * only things the extension keeps – in memory: the bridge session and, per tab, a pending save.
 * Pending data is dropped when the tab closes or after five minutes. Logs nothing.
 */
import { matchesOrigin, normalizeOrigin, originString } from '@nemo/vault-core';
import type { BridgeClient, CallError, ConnectionState } from './bridgeClient';
import { DEFAULT_GEN, generate, sanitize, type GenSettings, type Generated } from './generate';
import type { ContentCommand, Failure, Reply, Request } from './messages';

export const PENDING_TTL_MS = 5 * 60_000;

export interface Sender {
  tabId?: number;
  frameId?: number;
  /** Browser-provided origin of the sending frame (never taken from a message). */
  origin?: string;
  url?: string;
}

export interface TabInfo {
  id: number;
  url?: string;
}

export interface Deps {
  client: BridgeClient;
  now(): number;
  copySecret(text: string): Promise<void>;
  activeTab(): Promise<TabInfo | undefined>;
  sendToTab(tabId: number, frameId: number, command: ContentCommand): Promise<void>;
}

interface Pending {
  kind: 'save' | 'update';
  entryId?: string;
  title: string;
  username: string;
  password: string;
  origin: string;
  expiresAt: number;
}

export interface EntryInfo {
  id: string;
  title: string;
  username: string;
  url: string;
  hasTotp: boolean;
}

const failure = (error: Failure): Reply<never> => ({ ok: false, error });
const ok = <T>(data: T): Reply<T> => ({ ok: true, data });

function mapError(error: CallError): Failure {
  switch (error) {
    case 'locked':
    case 'app-missing':
    case 'not-paired':
    case 'origin-mismatch':
    case 'unknown-entry':
    case 'bad-request':
      return error;
    default:
      return 'failed';
  }
}

export function pageOriginOf(sender: { origin?: string; url?: string }): string | undefined {
  const candidate = sender.origin && sender.origin !== 'null' ? sender.origin : sender.url;
  const normalized = candidate ? normalizeOrigin(candidate) : null;
  return normalized ? originString(normalized) : undefined;
}

export function createBackground(deps: Deps) {
  const { client } = deps;
  const pending = new Map<number, Pending>();
  let gen: GenSettings = DEFAULT_GEN;

  const livePending = (tabId: number): Pending | undefined => {
    const p = pending.get(tabId);
    if (p && p.expiresAt <= deps.now()) {
      pending.delete(tabId);
      return undefined;
    }
    return p;
  };

  async function entriesFor(pageOrigin: string): Promise<Reply<EntryInfo[]>> {
    const r = await client.call('match', { pageOrigin });
    if (!r.ok) return failure(mapError(r.error));
    return ok((r.data as { entries: EntryInfo[] }).entries);
  }

  async function secret(
    entryId: string,
    pageOrigin: string,
    field: 'password' | 'totp',
  ): Promise<Reply<string>> {
    const r = await client.call('secret', { entryId, pageOrigin, field });
    if (!r.ok) return failure(mapError(r.error));
    return ok((r.data as { value: string }).value);
  }

  async function adoptAppGenerator(): Promise<void> {
    const r = await client.call('genParams', {});
    if (!r.ok) return;
    const p = r.data as GenSettings['password'];
    gen = sanitize({ ...gen, password: { ...gen.password, ...p } });
  }

  async function saveFromPending(tabId: number, edits: { title?: string; username?: string }) {
    const p = livePending(tabId);
    if (!p) return failure('failed');
    const title = (edits.title ?? p.title).trim() || p.title;
    const username = edits.username ?? p.username;
    const r =
      p.kind === 'update' && p.entryId
        ? await client.call('update', {
            entryId: p.entryId,
            password: p.password,
            pageOrigin: p.origin,
          })
        : await client.call('create', {
            title,
            username,
            password: p.password,
            url: '',
            pageOrigin: p.origin,
          });
    if (!r.ok) return failure(mapError(r.error)); // data stays in memory for a retry
    pending.delete(tabId);
    return ok({ kind: p.kind });
  }

  async function submitted(tabId: number, origin: string, username: string, password: string) {
    const known = livePending(tabId);
    if (known && known.origin === origin && known.password === password) return ok(null);
    const found = await entriesFor(origin);
    const base = { title: normalizeOrigin(origin)?.host ?? origin, username, password, origin };
    const expiresAt = deps.now() + PENDING_TTL_MS;
    if (!found.ok) {
      // App closed or locked: keep it for a later retry, the user decides then.
      pending.set(tabId, { kind: 'save', ...base, expiresAt });
      return ok({ kind: 'save' as const, title: base.title, username, origin });
    }
    const sameUser = found.data.find(
      (e) => username !== '' && e.username.toLowerCase() === username.toLowerCase(),
    );
    if (!sameUser) {
      pending.set(tabId, { kind: 'save', ...base, expiresAt });
      return ok({ kind: 'save' as const, title: base.title, username, origin });
    }
    const cmp = await client.call('compare', {
      entryId: sameUser.id,
      password,
      pageOrigin: origin,
    });
    if (cmp.ok && (cmp.data as { same: boolean }).same) return ok(null);
    pending.set(tabId, {
      kind: 'update',
      entryId: sameUser.id,
      ...base,
      title: sameUser.title,
      expiresAt,
    });
    return ok({ kind: 'update' as const, title: sameUser.title, username, origin });
  }

  async function popupTarget(): Promise<{ tab: TabInfo; origin: string } | undefined> {
    const tab = await deps.activeTab();
    const origin = tab?.url ? pageOriginOf({ url: tab.url }) : undefined;
    return tab && origin ? { tab, origin } : undefined;
  }

  async function handle(request: Request, sender: Sender): Promise<Reply> {
    const fromTab = sender.tabId;
    const origin = pageOriginOf(sender);

    switch (request.type) {
      case 'status': {
        const state = await client.connectState();
        if (state.state === 'unlocked') void adoptAppGenerator();
        return ok(state);
      }
      case 'generate': {
        if (request.settings) gen = sanitize(request.settings);
        else if (client.hasSession()) await adoptAppGenerator();
        const g: Generated = await generate(gen);
        return ok({ ...g, settings: gen });
      }
      case 'match':
        return origin ? entriesFor(origin) : failure('bad-request');
      case 'secret':
        return origin ? secret(request.entryId, origin, request.field) : failure('bad-request');
      case 'create': {
        if (!origin) return failure('bad-request');
        const r = await client.call('create', {
          title: request.title,
          username: request.username,
          password: request.password,
          url: '',
          pageOrigin: origin,
        });
        if (!r.ok) return failure(mapError(r.error));
        if (fromTab !== undefined) pending.delete(fromTab);
        return ok(r.data);
      }
      case 'pending-set': {
        if (fromTab === undefined || !origin) return failure('no-tab');
        pending.set(fromTab, {
          kind: 'save',
          title: request.title.trim() || normalizeOrigin(origin)?.host || origin,
          username: request.username,
          password: request.password,
          origin,
          expiresAt: deps.now() + PENDING_TTL_MS,
        });
        return ok(null);
      }
      case 'pending-get': {
        const p = fromTab === undefined ? undefined : livePending(fromTab);
        // Only offered on the same site (registrable domain) it came from; never the password.
        if (!p || !origin || !matchesOrigin(p.origin, origin, 'domain')) return ok(null);
        return ok({ kind: p.kind, title: p.title, username: p.username, origin: p.origin });
      }
      case 'pending-save':
        return fromTab === undefined ? failure('no-tab') : saveFromPending(fromTab, request);
      case 'pending-clear':
        if (fromTab !== undefined) pending.delete(fromTab);
        return ok(null);
      case 'submitted':
        if (fromTab === undefined || !origin) return failure('no-tab');
        return submitted(fromTab, origin, request.username, request.password);
      case 'popup-state': {
        const target = await popupTarget();
        const state: ConnectionState = await client.connectState();
        if (state.state !== 'unlocked')
          return ok({ state, origin: target?.origin ?? null, entries: [] });
        const found = target ? await entriesFor(target.origin) : ok([] as EntryInfo[]);
        return ok({
          state,
          origin: target?.origin ?? null,
          entries: found.ok ? found.data : [],
        });
      }
      case 'popup-fill': {
        const target = await popupTarget();
        if (!target) return failure('no-tab');
        const entries = await entriesFor(target.origin);
        if (!entries.ok) return entries;
        const entry = entries.data.find((e) => e.id === request.entryId);
        if (!entry) return failure('unknown-entry');
        const pw = await secret(entry.id, target.origin, 'password');
        if (!pw.ok) return pw;
        await deps.sendToTab(target.tab.id, 0, {
          type: 'do-fill',
          username: entry.username,
          password: pw.data,
        });
        return ok(null);
      }
      case 'popup-copy': {
        const target = await popupTarget();
        if (!target) return failure('no-tab');
        const entries = await entriesFor(target.origin);
        if (!entries.ok) return entries;
        const entry = entries.data.find((e) => e.id === request.entryId);
        if (!entry) return failure('unknown-entry');
        let text = entry.username;
        if (request.field !== 'username') {
          const value = await secret(entry.id, target.origin, request.field);
          if (!value.ok) return value;
          text = value.data;
        }
        if (!text) return failure('failed');
        await deps.copySecret(text);
        return ok(null);
      }
      case 'popup-copy-text':
        await deps.copySecret(request.text);
        return ok(null);
    }
  }

  return {
    handle,
    tabClosed(tabId: number) {
      pending.delete(tabId);
    },
    /** For tests: how many tabs hold pending data. */
    pendingCount: () => pending.size,
  };
}

export type Background = ReturnType<typeof createBackground>;
