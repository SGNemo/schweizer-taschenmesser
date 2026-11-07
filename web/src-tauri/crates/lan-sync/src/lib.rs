//! Home-network sync hub (concept: `docs/design/sync-lan/CONCEPT.md`).
//!
//! The store: its last-write-wins rule is the third copy of the rule in `web/src/core/sync/ops.ts`
//! and `server/src/store.ts`, pinned by `contract/*.json`. The store assumes exactly one `Store` per database file (the sequence counter is cached in memory).
//!
//! Package 2a adds the channel: `noise` (also used by clients), and for the desktop hub only
//! `pairing`, `trust`, `endpoint` and (2b-1) `hub`. Those are compiled out on Android and iOS: the hub never runs
//! there (root rule). Nothing here opens a socket (the sockets come with package 2b-2).

#![cfg_attr(not(test), forbid(unsafe_code))]

pub mod noise;
mod store;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub mod discovery;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub mod endpoint;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub mod hub;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub mod pairing;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub mod transport;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub mod trust;

pub use store::{FieldOp, PullResult, PushResult, Store, StoreError};
