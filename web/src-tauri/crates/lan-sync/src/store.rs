//! Field store: per `(collection, id, field)` only the op with the greatest HLC survives, every
//! accepted op gets the next `seq`. Mirrors `server/src/store.ts` (tables, upsert, paging, reset);
//! like the Node server it never merges or inspects values.

use rusqlite::{named_params, params, Connection};
use serde::{Deserialize, Serialize};

/// One field of one record, stamped with a hybrid logical clock value.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FieldOp {
    pub collection: String,
    pub id: String,
    pub field: String,
    pub hlc: String,
    /// Opaque JSON (an `enc:v1:` string in LAN mode; the handler checks that, not the store).
    pub value: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PushResult {
    pub accepted: usize,
    /// Highest `seq` handed out so far.
    pub cursor: i64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PullResult {
    pub ops: Vec<FieldOp>,
    /// Highest `seq` included; pass it as `since` next time.
    pub cursor: i64,
    pub more: bool,
}

#[derive(Debug)]
pub enum StoreError {
    Db(rusqlite::Error),
    Json(serde_json::Error),
    Random(getrandom::Error),
}

impl std::fmt::Display for StoreError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Db(e) => write!(f, "store: {e}"),
            Self::Json(e) => write!(f, "store value: {e}"),
            Self::Random(e) => write!(f, "store random: {e}"),
        }
    }
}

impl std::error::Error for StoreError {}

impl From<rusqlite::Error> for StoreError {
    fn from(e: rusqlite::Error) -> Self {
        Self::Db(e)
    }
}
impl From<serde_json::Error> for StoreError {
    fn from(e: serde_json::Error) -> Self {
        Self::Json(e)
    }
}
impl From<getrandom::Error> for StoreError {
    fn from(e: getrandom::Error) -> Self {
        Self::Random(e)
    }
}

const SCHEMA: &str = "
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
";

fn new_epoch() -> Result<String, StoreError> {
    let mut bytes = [0u8; 8];
    getrandom::fill(&mut bytes)?;
    Ok(bytes.iter().map(|b| format!("{b:02x}")).collect())
}

pub struct Store {
    db: Connection,
    seq: i64,
}

impl Store {
    /// `path` may be `":memory:"`.
    pub fn open(path: &str) -> Result<Self, StoreError> {
        let db = Connection::open(path)?;
        // WAL is not available for in-memory databases; the pragma then reports "memory".
        db.query_row("PRAGMA journal_mode = WAL", [], |_| Ok(()))?;
        db.execute_batch("PRAGMA synchronous = NORMAL;")?;
        db.execute_batch(SCHEMA)?;
        let has_epoch: bool = db.query_row(
            "SELECT EXISTS (SELECT 1 FROM meta WHERE key = 'epoch')",
            [],
            |r| r.get(0),
        )?;
        if !has_epoch {
            db.execute(
                "INSERT INTO meta (key, value) VALUES ('epoch', ?1)",
                [new_epoch()?],
            )?;
        }
        let seq = db.query_row("SELECT COALESCE(MAX(seq), 0) FROM field_state", [], |r| {
            r.get(0)
        })?;
        Ok(Self { db, seq })
    }

    /// Identifies this data set. Changes on [`reset`](Self::reset); clients restart their sync.
    pub fn epoch(&self) -> Result<String, StoreError> {
        Ok(self
            .db
            .query_row("SELECT value FROM meta WHERE key = 'epoch'", [], |r| {
                r.get(0)
            })?)
    }

    /// Accepts an op only if its HLC is greater than the stored one (field-level last-write-wins).
    /// The comparison is SQLite's BINARY text order, which equals string comparison for the
    /// ASCII-only HLC format – the same condition as in `server/src/store.ts`.
    pub fn push(&mut self, ops: &[FieldOp]) -> Result<PushResult, StoreError> {
        let tx = self.db.transaction()?;
        let mut seq = self.seq;
        let mut accepted = 0;
        {
            let mut upsert = tx.prepare(
                "INSERT INTO field_state (collection, id, field, hlc, value, seq)
                 VALUES (:collection, :id, :field, :hlc, :value, :seq)
                 ON CONFLICT (collection, id, field) DO UPDATE
                   SET hlc = excluded.hlc, value = excluded.value, seq = excluded.seq
                   WHERE excluded.hlc > field_state.hlc",
            )?;
            for op in ops {
                let next = seq + 1;
                let changed = upsert.execute(named_params! {
                    ":collection": op.collection,
                    ":id": op.id,
                    ":field": op.field,
                    ":hlc": op.hlc,
                    ":value": serde_json::to_string(&op.value)?,
                    ":seq": next,
                })?;
                if changed > 0 {
                    seq = next;
                    accepted += 1;
                }
            }
        }
        tx.commit()?;
        self.seq = seq;
        Ok(PushResult {
            accepted,
            cursor: seq,
        })
    }

    /// Ops with `seq > since` in `seq` order, at most `limit`.
    pub fn pull(&self, since: i64, limit: usize) -> Result<PullResult, StoreError> {
        let mut stmt = self.db.prepare(
            "SELECT collection, id, field, hlc, value, seq FROM field_state
             WHERE seq > ?1 ORDER BY seq LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![since, i64::try_from(limit).unwrap_or(i64::MAX).saturating_add(1)], |r| {
            Ok((
                FieldOp {
                    collection: r.get(0)?,
                    id: r.get(1)?,
                    field: r.get(2)?,
                    hlc: r.get(3)?,
                    value: serde_json::Value::Null,
                },
                r.get::<_, String>(4)?,
                r.get::<_, i64>(5)?,
            ))
        })?;
        let mut page = Vec::new();
        for row in rows {
            let (mut op, raw, seq) = row?;
            op.value = serde_json::from_str(&raw)?;
            page.push((op, seq));
        }
        let more = page.len() > limit;
        page.truncate(limit);
        let cursor = page.last().map_or(since, |(_, seq)| *seq);
        Ok(PullResult {
            ops: page.into_iter().map(|(op, _)| op).collect(),
            cursor,
            more,
        })
    }

    /// Wipes all field data and starts a new epoch (key rotation, CONCEPT §5); returns it.
    pub fn reset(&mut self) -> Result<String, StoreError> {
        let epoch = new_epoch()?;
        let tx = self.db.transaction()?;
        tx.execute("DELETE FROM field_state", [])?;
        tx.execute("UPDATE meta SET value = ?1 WHERE key = 'epoch'", [&epoch])?;
        tx.commit()?;
        self.seq = 0;
        Ok(epoch)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pull_with_huge_limit_does_not_overflow() {
        let store = Store::open(":memory:").unwrap();
        let page = store.pull(0, usize::MAX).unwrap();
        assert!(page.ops.is_empty());
        assert!(!page.more);
    }
}
