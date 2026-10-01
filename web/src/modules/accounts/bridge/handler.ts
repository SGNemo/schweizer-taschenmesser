/**
 * The meaning of the extension's requests (the Rust side only moves bytes). Rules:
 *  - every message is validated strictly (`requestSchema`); anything else is `bad-request`
 *  - only the allowlisted extension ID is served, and only after the user confirmed it (pairing)
 *  - a locked vault answers with its state and nothing else
 *  - secrets and writes need a session (from `hello`) with a strictly increasing `seq`; a reused
 *    request id is a replay; locking ends every session at once
 *  - an entry is only offered, revealed or changed for a page whose origin matches its stored URL
 *  - each answer carries only what was asked for, and only codes on error – never URLs or values
 * Nothing is logged.
 */
import {
  EXTENSION_ID,
  MAX_MESSAGE_BYTES,
  errorReply,
  extensionIdOf,
  matchesOrigin,
  normalizeOrigin,
  okReply,
  originString,
  requestSchema,
  type BridgeErrorCode,
  type BridgeReply,
  type BridgeRequest,
  type OriginMatchMode,
  type PasswordOptions,
} from '@nemo/vault-core';
import type { EntryDraft } from '../schema';
import { totpNow } from '../totp';
import type { DecryptedEntry } from '../vault';

export const PAIRING_TTL_MS = 2 * 60_000;
export const SECRETS_PER_MINUTE = 30;
const MAX_SESSIONS = 5;
const SESSION_MAX_AGE_MS = 12 * 60 * 60_000;
const SEEN_IDS = 500;

export interface PendingPairing {
  extensionId: string;
  code: string;
  expiresAt: number;
}

export interface BridgeDeps {
  now(): number;
  /** Uniform integer in [0, max) from the platform CSPRNG. */
  randomInt(max: number): number;
  /** URL-safe random string of `bytes` random bytes. */
  randomToken(bytes: number): string;
  isUnlocked(): boolean;
  originMode(): Promise<OriginMatchMode>;
  generatorOptions(): Promise<PasswordOptions>;
  isPaired(extensionId: string): Promise<boolean>;
  addPaired(extensionId: string): Promise<void>;
  entries(): Promise<DecryptedEntry[]>;
  save(draft: EntryDraft, id?: string): Promise<string>;
  /** The pairing request changed (new, confirmed, declined, expired); null = none open. */
  onPairingChange(pending: PendingPairing | null): void;
}

interface Session {
  extensionId: string;
  createdAt: number;
  lastSeq: number;
  secretTimes: number[];
}

export interface BridgeHandler {
  /** Request JSON in, reply JSON out. Never throws. */
  handle(raw: string): Promise<string>;
  /** Drops every session (the vault locked, the bridge was switched off, an extension was removed). */
  endSessions(): void;
  pending(): PendingPairing | null;
  confirmPairing(): Promise<void>;
  declinePairing(): void;
}

const DECLINE_COOLDOWN_MS = 2 * 60_000;

export function createBridgeHandler(deps: BridgeDeps): BridgeHandler {
  const sessions = new Map<string, Session>();
  const seen: string[] = [];
  const seenSet = new Set<string>();
  let pending: PendingPairing | null = null;
  let declinedUntil = 0;

  const setPending = (next: PendingPairing | null) => {
    pending = next;
    deps.onPairingChange(next);
  };
  const livePending = (): PendingPairing | null => {
    if (pending && pending.expiresAt <= deps.now()) setPending(null);
    return pending;
  };

  const remember = (id: string): boolean => {
    if (seenSet.has(id)) return false;
    seenSet.add(id);
    seen.push(id);
    if (seen.length > SEEN_IDS) seenSet.delete(seen.shift()!);
    return true;
  };

  const endSessions = () => {
    sessions.clear();
    if (pending) setPending(null);
  };

  const fail = (id: string, code: BridgeErrorCode): BridgeReply => errorReply(id, code);

  async function hello(req: BridgeRequest, extensionId: string): Promise<BridgeReply> {
    if (extensionId !== EXTENSION_ID) return okReply(req.id, { state: 'rejected' });
    if (!deps.isUnlocked()) return okReply(req.id, { state: 'locked' });
    if (!(await deps.isPaired(extensionId))) {
      if (deps.now() < declinedUntil) return okReply(req.id, { state: 'rejected' });
      let open = livePending();
      if (!open || open.extensionId !== extensionId) {
        const code = String(deps.randomInt(1_000_000)).padStart(6, '0');
        open = { extensionId, code, expiresAt: deps.now() + PAIRING_TTL_MS };
        setPending(open);
      }
      return okReply(req.id, { state: 'pairing', pairCode: open.code });
    }
    // Oldest sessions of this extension go first.
    const mine = [...sessions.entries()].filter(([, s]) => s.extensionId === extensionId);
    for (const [id] of mine.slice(0, Math.max(0, mine.length - MAX_SESSIONS + 1))) {
      sessions.delete(id);
    }
    const session = deps.randomToken(24);
    sessions.set(session, {
      extensionId,
      createdAt: deps.now(),
      lastSeq: 0,
      secretTimes: [],
    });
    return okReply(req.id, { state: 'unlocked', session });
  }

  /** The session behind a request, or the error code to answer with. */
  function authorize(req: BridgeRequest, extensionId: string): Session | BridgeErrorCode {
    if (!deps.isUnlocked()) {
      endSessions();
      return 'locked';
    }
    const session = req.session ? sessions.get(req.session) : undefined;
    if (!session || session.extensionId !== extensionId) return 'no-session';
    if (deps.now() - session.createdAt > SESSION_MAX_AGE_MS) {
      sessions.delete(req.session!);
      return 'no-session';
    }
    if (req.seq === undefined || req.seq <= session.lastSeq) return 'replay';
    session.lastSeq = req.seq;
    return session;
  }

  async function authorized(
    req: BridgeRequest,
    session: Session,
    mode: OriginMatchMode,
  ): Promise<BridgeReply> {
    switch (req.op) {
      case 'genParams':
        return okReply(req.id, await deps.generatorOptions());
      case 'match': {
        const entries = (await deps.entries()).filter(
          (e) => e.data.url && matchesOrigin(e.data.url, req.body.pageOrigin, mode),
        );
        return okReply(req.id, {
          entries: entries.map((e) => ({
            id: e.id,
            title: e.data.title,
            username: e.data.username,
            url: e.data.url,
            hasTotp: Boolean(e.data.totp),
          })),
        });
      }
      case 'secret': {
        const found = await matching(req.body.entryId, req.body.pageOrigin, mode);
        if (typeof found === 'string') return fail(req.id, found);
        const at = deps.now();
        session.secretTimes = session.secretTimes.filter((t) => at - t < 60_000);
        if (session.secretTimes.length >= SECRETS_PER_MINUTE) return fail(req.id, 'rate-limited');
        session.secretTimes.push(at);
        const { data } = found;
        if (req.body.field === 'password') return okReply(req.id, { value: data.password });
        if (!data.totp) return fail(req.id, 'unknown-entry');
        return okReply(req.id, { value: totpNow(data.totp, at).code });
      }
      case 'create': {
        const page = normalizeOrigin(req.body.pageOrigin);
        if (!page) return fail(req.id, 'bad-request');
        // The stored URL must belong to the page the data comes from; default to that origin.
        const url = req.body.url ? req.body.url : originString(page);
        if (!matchesOrigin(url, req.body.pageOrigin, mode)) return fail(req.id, 'origin-mismatch');
        const id = await deps.save({
          title: req.body.title.trim() || page.host,
          username: req.body.username,
          password: req.body.password,
          url,
          notes: '',
          tags: [],
          favorite: false,
        });
        return okReply(req.id, { id });
      }
      case 'compare': {
        const found = await matching(req.body.entryId, req.body.pageOrigin, mode);
        if (typeof found === 'string') return fail(req.id, found);
        return okReply(req.id, { same: found.data.password === req.body.password });
      }
      case 'update': {
        const found = await matching(req.body.entryId, req.body.pageOrigin, mode);
        if (typeof found === 'string') return fail(req.id, found);
        await deps.save({ ...found.data, password: req.body.password }, found.id);
        return okReply(req.id, { ok: true });
      }
      default:
        return fail(req.id, 'bad-request');
    }
  }

  async function matching(
    entryId: string,
    pageOrigin: string,
    mode: OriginMatchMode,
  ): Promise<DecryptedEntry | BridgeErrorCode> {
    const entry = (await deps.entries()).find((e) => e.id === entryId);
    if (!entry) return 'unknown-entry';
    return entry.data.url && matchesOrigin(entry.data.url, pageOrigin, mode)
      ? entry
      : 'origin-mismatch';
  }

  async function dispatch(raw: string): Promise<BridgeReply> {
    let json: unknown;
    try {
      if (raw.length > MAX_MESSAGE_BYTES) return fail('', 'bad-request');
      json = JSON.parse(raw);
    } catch {
      return fail('', 'bad-request');
    }
    const parsed = requestSchema.safeParse(json);
    if (!parsed.success) {
      const id = (json as { id?: unknown } | null)?.id;
      return fail(typeof id === 'string' ? id.slice(0, 64) : '', 'bad-request');
    }
    const req = parsed.data;
    if (!remember(req.id)) return fail(req.id, 'replay');
    const extensionId = extensionIdOf(req.origin);
    if (extensionId !== EXTENSION_ID) {
      return req.op === 'hello'
        ? okReply(req.id, { state: 'rejected' })
        : fail(req.id, 'not-paired');
    }
    if (req.op === 'hello') return hello(req, extensionId);
    if (req.op === 'status') {
      return okReply(req.id, { state: deps.isUnlocked() ? 'unlocked' : 'locked' });
    }
    const session = authorize(req, extensionId);
    if (typeof session === 'string') return fail(req.id, session);
    return authorized(req, session, await deps.originMode());
  }

  return {
    async handle(raw) {
      try {
        return JSON.stringify(await dispatch(raw));
      } catch {
        // Whatever went wrong, the answer names no cause.
        return JSON.stringify(fail('', 'internal'));
      }
    },
    endSessions,
    pending: livePending,
    async confirmPairing() {
      const open = livePending();
      if (!open || !deps.isUnlocked()) return;
      await deps.addPaired(open.extensionId);
      setPending(null);
    },
    declinePairing() {
      if (!pending) return;
      declinedUntil = deps.now() + DECLINE_COOLDOWN_MS;
      setPending(null);
    },
  };
}
