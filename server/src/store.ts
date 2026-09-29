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

export interface Store {
  /** Identifies this data set. Changes on reset; clients restart their sync when it differs. */
  epoch(): string;
  vault(): Vault | null;
  /** First writer wins; returns false when a vault exists already. */
  setVault(vault: Vault): boolean;
  /** Accepts an op only if its HLC is greater than the stored one (field-level last-write-wins). */
  push(ops: FieldOp[]): { accepted: number; cursor: number };
  pull(since: number, limit: number): PullResult;
  /** Wipes all data and the vault; returns the new epoch. */
  reset(): string;
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
    delMeta.run('vault.salt');
    delMeta.run('vault.check');
    const epoch = newEpoch();
    setMeta.run('epoch', epoch);
    seq = 0;
    return epoch;
  });

  return {
    epoch: () => meta('epoch')!,
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
