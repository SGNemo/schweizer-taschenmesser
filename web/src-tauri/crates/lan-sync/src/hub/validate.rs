//! Push validation. [`validate_push`] runs over the **whole** batch before `Store::push` is called,
//! so a bad op anywhere stores nothing, takes no `seq` and keeps the epoch.
//!
//! The HLC rule mirrors `server/src/app.ts` (`^\d{13}-\d{4}-[a-z0-9]{1,32}$`): ASCII only and a
//! fixed shape, because the store compares HLCs as bytes (Rust `&str`/SQLite BINARY) while the
//! client compares UTF-16 code units; the two orders agree only on ASCII.

use super::{MAX_HLC_DRIFT_MS, MAX_OPS_PER_PUSH, MAX_VALUE_BYTES};
use crate::FieldOp;

/// The value prefix of end-to-end encrypted values (`web/src/core/sync/crypto.ts`). Every value
/// the hub stores must carry it, tombstones (`deletedAt`) included: the client encrypts all ops.
pub const ENC_PREFIX: &str = "enc:v1:";

/// Why a request was refused. The names are the wire codes (kebab-case) and the abstract error
/// names of `contract/sync-paging-cases.json`. Carries no data.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HubError {
    /// Not valid JSON of the request shape, or a number out of range.
    BadRequest,
    /// The request names another key version than the hub's (stale device or after a rotation).
    StaleKeyVersion,
    TooManyOps,
    /// A collection/id/field outside the allowed shape.
    BadOp,
    BadHlc,
    HlcDrift,
    /// The value is not an `enc:v1:` string.
    MissingEnc,
    ValueTooLarge,
    LimitTooLarge,
    /// The answer does not fit one Noise frame; ask for a smaller page.
    ResponseTooLarge,
    /// Store or lock failure; no detail on purpose.
    Internal,
}

impl HubError {
    pub fn code(self) -> &'static str {
        match self {
            HubError::BadRequest => "bad-request",
            HubError::StaleKeyVersion => "stale-key-version",
            HubError::TooManyOps => "too-many-ops",
            HubError::BadOp => "bad-op",
            HubError::BadHlc => "bad-hlc",
            HubError::HlcDrift => "hlc-drift",
            HubError::MissingEnc => "missing-enc",
            HubError::ValueTooLarge => "value-too-large",
            HubError::LimitTooLarge => "limit-too-large",
            HubError::ResponseTooLarge => "response-too-large",
            HubError::Internal => "internal",
        }
    }
}

/// `^\d{13}-\d{4}-[a-z0-9]{1,32}$` on bytes; returns the wall-clock part in ms.
pub fn parse_hlc_wall(hlc: &str) -> Option<u64> {
    let b = hlc.as_bytes();
    if !(20..=51).contains(&b.len()) || b[13] != b'-' || b[18] != b'-' {
        return None;
    }
    if !b[..13].iter().all(u8::is_ascii_digit) || !b[14..18].iter().all(u8::is_ascii_digit) {
        return None;
    }
    if !b[19..]
        .iter()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
    {
        return None;
    }
    hlc[..13].parse().ok()
}

/// `^[A-Za-z_][A-Za-z0-9_]{0,63}$`
fn collection_ok(s: &str) -> bool {
    let b = s.as_bytes();
    !b.is_empty()
        && b.len() <= 64
        && (b[0].is_ascii_alphabetic() || b[0] == b'_')
        && b.iter().all(|c| c.is_ascii_alphanumeric() || *c == b'_')
}

/// Length in UTF-16 code units, like `maxLength` in the Node server.
fn within(s: &str, max: usize) -> bool {
    !s.is_empty() && s.encode_utf16().take(max + 1).count() <= max
}

/// Checks a whole batch against the rules of the server plus the LAN-only `enc:v1:` rule.
/// `now_ms` is the hub's clock (unix ms).
pub fn validate_push(ops: &[FieldOp], now_ms: u64) -> Result<(), HubError> {
    if ops.len() > MAX_OPS_PER_PUSH {
        return Err(HubError::TooManyOps);
    }
    let latest = now_ms.saturating_add(MAX_HLC_DRIFT_MS);
    for op in ops {
        if !collection_ok(&op.collection) || !within(&op.id, 128) || !within(&op.field, 64) {
            return Err(HubError::BadOp);
        }
        let wall = parse_hlc_wall(&op.hlc).ok_or(HubError::BadHlc)?;
        let Some(text) = op.value.as_str().filter(|s| s.starts_with(ENC_PREFIX)) else {
            return Err(HubError::MissingEnc);
        };
        // an `enc:v1:` value is a JSON string: two quotes plus the text (escapes only add)
        if text.len().saturating_add(2) > MAX_VALUE_BYTES {
            return Err(HubError::ValueTooLarge);
        }
        if wall > latest {
            return Err(HubError::HlcDrift);
        }
    }
    Ok(())
}
