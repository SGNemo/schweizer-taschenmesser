//! Home-network sync hub (concept: `docs/design/sync-lan/CONCEPT.md`).
//!
//! Package 1 holds only the store. Its last-write-wins rule is the third copy of the rule in
//! `web/src/core/sync/ops.ts` and `server/src/store.ts` and is pinned by `contract/*.json`.

//! The store assumes exactly one `Store` per database file (the sequence counter is cached in memory).

pub mod noise;
mod store;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub mod pairing;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub mod trust;

pub use store::{FieldOp, PullResult, PushResult, Store, StoreError};
