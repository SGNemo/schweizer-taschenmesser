import { randomBytes } from 'node:crypto';
import Database from 'better-sqlite3';

/** One field of one record, stamped with a hybrid logical clock value. */
export interface FieldOp {
  collection: string;
  id: string;
  field: string;
  hlc: string;
  /** Opaque JSON (plain value, or an encrypted string when the client uses end-to-end encryption). */
  value: unknown;
}

export interface PullResult {
  ops: FieldOp[];
  /** Highest seq included; pass it as `since` next time. */
  cursor: number;
  more: boolean;
}

export interface Vault {
  /** base64 */
  salt: string;
  /** Encrypted known plaintext, lets clients verify a passphrase without any user data. */
  check: string;
}

export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface ScheduledPush {
  endpoint: string;
  key: string;
  /** Epoch ms. */
  at: number;
  /** Opaque to the server (plain JSON, or ciphertext when the client uses end-to-end encryption). */
  payload: string;
  attempts: number;
}

export interface Store {
  /** Identifies this data set. Changes on reset; clients restart their sync when it differs. */
  epoch(): string;
  vault(): Vault | null;
  /** First writer wins; returns false when a vault exists already. */
  setVault(vault: Vault): boolean;
  /** Accepts an op only if its HLC is greater than the stored one (field-level last-write-wins). */
  push(ops: FieldOp[]): { accepted: number; cursor: number };
  pull(since: number, limit: number): PullResult;
  /** Wipes all data and the vault; returns the new epoch. Push subscriptions survive, their schedules do not. */
  reset(): string;

  /* ---- Web Push ---- */
  vapid(): { publicKey: string; privateKey: string } | null;
  setVapid(keys: { publicKey: string; privateKey: string }): void;
  upsertSubscription(sub: PushSubscriptionRecord): void;
  getSubscription(endpoint: string): PushSubscriptionRecord | undefined;
  /** Also drops the subscription's schedule. */
  removeSubscription(endpoint: string): void;
  /**
   * Replaces the schedule of a subscription. Items that were already sent (recently) are not
   * re-added, so a late upload of a stale list cannot cause a second notification.
   */
  replaceSchedule(endpoint: string, items: { key: string; at: number; payload: string }[]): number;
  dueItems(now: number, limit: number): ScheduledPush[];
  markSent(endpoint: string, key: string, now: number): void;
  /** Counts a failed attempt; the item is dropped once it reached `maxAttempts`. */
  markFailed(endpoint: string, key: string, maxAttempts: number): void;
  /** Drops items that are too old to be worth sending and old "sent" markers. */
  purgePush(now: number, staleBefore: number, sentBefore: number): void;
  close(): void;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS field_state (
  collection TEXT NOT NULL,
  id         TEXT NOT NULL,
  field      TEXT NOT NULL,
  hlc        TEXT NOT NULL,
  value      TEXT NOT NULL,
  seq        INTEGER NOT NULL,
  PRIMARY KEY (collection, id, field)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS field_state_seq ON field_state (seq);
CREATE TABLE IF NOT EXISTS push_subscription (
  endpoint TEXT PRIMARY KEY,
  p256dh   TEXT NOT NULL,
  auth     TEXT NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS push_item (
  endpoint TEXT NOT NULL,
  key      TEXT NOT NULL,
  at       INTEGER NOT NULL,
  payload  TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (endpoint, key)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS push_item_at ON push_item (at);
CREATE TABLE IF NOT EXISTS push_sent (
  endpoint TEXT NOT NULL,
  key      TEXT NOT NULL,
  sent_at  INTEGER NOT NULL,
  PRIMARY KEY (endpoint, key)
) WITHOUT ROWID;
`;

const newEpoch = () => randomBytes(8).toString('hex');

export function openStore(path: string): Store {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.exec(SCHEMA);

  const getMeta = db.prepare<[string], { value: string }>('SELECT value FROM meta WHERE key = ?');
  const setMeta = db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)');
  const delMeta = db.prepare('DELETE FROM meta WHERE key = ?');
  const meta = (key: string) => getMeta.get(key)?.value;

  if (!meta('epoch')) setMeta.run('epoch', newEpoch());

  // BINARY text comparison equals JS string comparison for the ASCII-only HLC format.
  const upsert = db.prepare(
    `INSERT INTO field_state (collection, id, field, hlc, value, seq)
     VALUES (@collection, @id, @field, @hlc, @value, @seq)
     ON CONFLICT (collection, id, field) DO UPDATE
       SET hlc = excluded.hlc, value = excluded.value, seq = excluded.seq
       WHERE excluded.hlc > field_state.hlc`,
  );
  const selectSince = db.prepare<
    [number, number],
    Omit<FieldOp, 'value'> & { value: string; seq: number }
  >(
    `SELECT collection, id, field, hlc, value, seq FROM field_state
     WHERE seq > ? ORDER BY seq LIMIT ?`,
  );
  const maxSeq = db.prepare<[], { seq: number }>(
    'SELECT COALESCE(MAX(seq), 0) AS seq FROM field_state',
  );

  let seq = maxSeq.get()!.seq;

  const pushTx = db.transaction((ops: FieldOp[]) => {
    let accepted = 0;
    for (const op of ops) {
      const next = seq + 1;
      const info = upsert.run({
        collection: op.collection,
        id: op.id,
        field: op.field,
        hlc: op.hlc,
        value: JSON.stringify(op.value ?? null),
        seq: next,
      });
      if (info.changes > 0) {
        seq = next;
        accepted++;
      }
    }
    return accepted;
  });

  const resetTx = db.transaction(() => {
    db.exec('DELETE FROM field_state');
    db.exec('DELETE FROM push_item');
    db.exec('DELETE FROM push_sent');
    delMeta.run('vault.salt');
    delMeta.run('vault.check');
    const epoch = newEpoch();
    setMeta.run('epoch', epoch);
    seq = 0;
    return epoch;
  });

  const upsertSub = db.prepare(
    `INSERT INTO push_subscription (endpoint, p256dh, auth) VALUES (@endpoint, @p256dh, @auth)
     ON CONFLICT (endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`,
  );
  const getSub = db.prepare<[string], PushSubscriptionRecord>(
    'SELECT endpoint, p256dh, auth FROM push_subscription WHERE endpoint = ?',
  );
  const delSub = db.prepare('DELETE FROM push_subscription WHERE endpoint = ?');
  const delItems = db.prepare('DELETE FROM push_item WHERE endpoint = ?');
  const delSentFor = db.prepare('DELETE FROM push_sent WHERE endpoint = ?');
  const insertItem = db.prepare(
    `INSERT OR REPLACE INTO push_item (endpoint, key, at, payload, attempts)
     VALUES (?, ?, ?, ?, COALESCE((SELECT attempts FROM push_item WHERE endpoint = ? AND key = ?), 0))`,
  );
  const wasSent = db.prepare<[string, string], { one: number }>(
    'SELECT 1 AS one FROM push_sent WHERE endpoint = ? AND key = ?',
  );
  const keysOf = db.prepare<[string], { key: string }>(
    'SELECT key FROM push_item WHERE endpoint = ?',
  );
  const delItem = db.prepare('DELETE FROM push_item WHERE endpoint = ? AND key = ?');
  const selectDue = db.prepare<[number, number], ScheduledPush>(
    `SELECT endpoint, key, at, payload, attempts FROM push_item WHERE at <= ? ORDER BY at LIMIT ?`,
  );
  const markSentRow = db.prepare(
    'INSERT OR REPLACE INTO push_sent (endpoint, key, sent_at) VALUES (?, ?, ?)',
  );
  const bumpAttempts = db.prepare(
    'UPDATE push_item SET attempts = attempts + 1 WHERE endpoint = ? AND key = ?',
  );
  const dropExhausted = db.prepare('DELETE FROM push_item WHERE attempts >= ?');
  const purgeStale = db.prepare('DELETE FROM push_item WHERE at < ?');
  const purgeSent = db.prepare('DELETE FROM push_sent WHERE sent_at < ?');

  const replaceTx = db.transaction(
    (endpoint: string, items: { key: string; at: number; payload: string }[]) => {
      const keep = new Set<string>();
      let stored = 0;
      for (const item of items) {
        if (wasSent.get(endpoint, item.key)) continue;
        insertItem.run(endpoint, item.key, item.at, item.payload, endpoint, item.key);
        keep.add(item.key);
        stored++;
      }
      // Whatever the client no longer lists (deleted or rescheduled) must not fire any more.
      for (const { key } of keysOf.all(endpoint)) if (!keep.has(key)) delItem.run(endpoint, key);
      return stored;
    },
  );

  return {
    epoch: () => meta('epoch')!,
    vapid() {
      const publicKey = meta('vapid.public');
      const privateKey = meta('vapid.private');
      return publicKey && privateKey ? { publicKey, privateKey } : null;
    },
    setVapid(keys) {
      db.transaction(() => {
        setMeta.run('vapid.public', keys.publicKey);
        setMeta.run('vapid.private', keys.privateKey);
      })();
    },
    upsertSubscription: (sub) => void upsertSub.run(sub),
    getSubscription: (endpoint) => getSub.get(endpoint),
    removeSubscription: (endpoint) =>
      void db.transaction(() => {
        delItems.run(endpoint);
        delSentFor.run(endpoint);
        delSub.run(endpoint);
      })(),
    replaceSchedule: (endpoint, items) => replaceTx(endpoint, items),
    dueItems: (now, limit) => selectDue.all(now, limit),
    markSent: (endpoint, key, now) =>
      void db.transaction(() => {
        delItem.run(endpoint, key);
        markSentRow.run(endpoint, key, now);
      })(),
    markFailed(endpoint, key, maxAttempts) {
      bumpAttempts.run(endpoint, key);
      dropExhausted.run(maxAttempts);
    },
    purgePush(_now, staleBefore, sentBefore) {
      purgeStale.run(staleBefore);
      purgeSent.run(sentBefore);
    },
    vault() {
      const salt = meta('vault.salt');
      const check = meta('vault.check');
      return salt && check ? { salt, check } : null;
    },
    setVault(v) {
      if (meta('vault.salt')) return false;
      db.transaction(() => {
        setMeta.run('vault.salt', v.salt);
        setMeta.run('vault.check', v.check);
      })();
      return true;
    },
    push(ops) {
      const accepted = pushTx(ops);
      return { accepted, cursor: seq };
    },
    pull(since, limit) {
      const rows = selectSince.all(since, limit + 1);
      const more = rows.length > limit;
      const page = more ? rows.slice(0, limit) : rows;
      return {
        ops: page.map((r) => ({
          collection: r.collection,
          id: r.id,
          field: r.field,
          hlc: r.hlc,
          value: JSON.parse(r.value) as unknown,
        })),
        cursor: page.length ? page[page.length - 1]!.seq : since,
        more,
      };
    },
    reset: () => resetTx(),
    close: () => db.close(),
  };
}
