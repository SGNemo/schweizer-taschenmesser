//! The hub core (package 2b-1): what a hub does with a request, without any socket or OS call.
//!
//! * `validate`: every rule a pushed batch must pass **before** the store sees it.
//! * `handler`: [`Hub`] = store + key version + rotation; one JSON request/response shape for the
//!   hub-local client (in process) and for remote clients (inside Noise frames).
//! * `router`: per-connection routing of frames (a connection only ever reaches its own pairing
//!   attempt or session), pre-handshake admission and the handshake rate limit.
//! * `netpolicy`: which addresses the hub may bind and when it may listen at all (fail-closed).
//!
//! Nothing here logs, opens a socket or reads the clock: times come in as arguments. Compiled out
//! on Android and iOS (see `lib.rs`).

pub mod handler;
pub mod home;
pub mod netpolicy;
pub mod router;
pub mod validate;

pub use handler::{Hub, Request, Response, Rotated};
pub use validate::HubError;

/// Same numbers as `server/src/app.ts` (the handler-level cases of `contract/sync-paging-cases.json`
/// pin them from both sides), except [`MAX_VALUE_BYTES`].
///
/// Over the LAN one Noise frame is at most 65 535 B, so a request or a response carries well under
/// 5 000 ops or 1 MB whatever these numbers say: the frame is the effective cap for remote clients
/// (the hub-local client is not framed, but is held to the same value cap).
pub const MAX_OPS_PER_PUSH: usize = 5000;
pub const MAX_PULL_LIMIT: usize = 5000;
pub const DEFAULT_PULL_LIMIT: usize = 1000;
/// Largest JSON-encoded value (the quoted `enc:v1:` string). LAN-only and far below the server's
/// 1 MB: a pull answer with a single op of this size, plus the worst-case metadata (every id/field
/// character escaped as `\u00XX`), still fits one frame, so a stored value can always be delivered
/// (`one_max_value_is_always_deliverable`). Bigger values need fragmentation (not built).
pub const MAX_VALUE_BYTES: usize = 60_000;
pub const MAX_HLC_DRIFT_MS: u64 = 60 * 60 * 1000;
/// Largest request body the handler parses at all (the Noise frame is smaller; in-process calls
/// are not).
pub const MAX_REQUEST_BYTES: usize = 8 * 1024 * 1024;

/// Application frame tags inside a session (`noise::frame::TAG_APP_MIN` and up).
pub const TAG_REQUEST: u8 = 0x10;
pub const TAG_RESPONSE: u8 = 0x11;

#[cfg(test)]
mod tests;
