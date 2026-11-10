//! Home-network sync hub (concept: `docs/design/sync-lan/CONCEPT.md`).
//!
//! The store: its last-write-wins rule is the third copy of the rule in `web/src/core/sync/ops.ts`
//! and `server/src/store.ts`, pinned by `contract/*.json`. The store assumes exactly one `Store` per database file (the sequence counter is cached in memory).
//!
//! Package 2a adds the channel: `noise` (also used by clients), and for the desktop hub only
//! `pairing`, `trust`, `endpoint` and (2b-1) `hub`. Those are compiled out on Android and iOS: the hub never runs
//! there (root rule). Nothing here opens a socket (the sockets come with package 2b-2).

#![cfg_attr(not(test), forbid(unsafe_code))]

/// The daily mDNS hint (hub announces it, devices match it to find a hub that got a new address).
pub mod hint;
/// Remote control (phone → PC input): the wire format on every target, the hub side on the desktop.
pub mod input;
pub mod noise;
/// The pairing QR (hub writes it, devices read it): on every target.
pub mod qr;
#[cfg(feature = "store")]
mod store;

/// The device side (phone, second PC): pairing by QR and sessions with the hub. Its sockets live
/// under `src/transport` like the hub's (`tests/rules.rs`), but it is compiled on every target.
#[path = "transport/client.rs"]
pub mod client;
/// The device side of remote control (the phone): an input session with the hub. Its socket lives
/// under `src/transport` like every other; compiled on every target.
#[path = "transport/input_client.rs"]
pub mod input_client;
/// Device side: picks the announcements of the pinned hub after it got a new address.
#[path = "transport/rediscover.rs"]
pub mod rediscover;

#[cfg(all(not(any(target_os = "android", target_os = "ios")), feature = "store"))]
pub mod discovery;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub mod endpoint;
#[cfg(all(not(any(target_os = "android", target_os = "ios")), feature = "store"))]
pub mod hub;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub mod keys;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub mod pairing;
#[cfg(all(not(any(target_os = "android", target_os = "ios")), feature = "store"))]
pub mod supervisor;
#[cfg(all(not(any(target_os = "android", target_os = "ios")), feature = "store"))]
pub mod transport;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub mod trust;

#[cfg(feature = "store")]
pub use store::{FieldOp, PullResult, PushResult, Store, StoreError};
