//! Remote control: a paired phone steers this PC (concept `docs/design/remote-control/CONCEPT.md`,
//! rule `docs/rules/remote-control.md`). **Pairing is not permission.**
//!
//! * `wire`: the frames of an input session (both sides, every target).
//! * `remote` (hub): the PC's master switch, the per-device grant and the one controller slot.
//!   Everything in it is changed only by the PC's own controls; no frame from the network reaches
//!   a setter.
//! * `session` (hub): one input connection – `hello`, `open`, then events through the gate
//!   (switch, grant, the session's fixed level, lock state, rate limits) into the [`InputSink`].
//! * `limits` (hub): token buckets. Time comes in as an argument; nothing here reads a clock.
//! * `sink` (hub): the typed boundary to whatever simulates input. This crate has no OS input API;
//!   the shell passes a sink in.
//!
//! An input session is its own handshake mode (`noise::Mode::Input`) on the hub's listener: it
//! never carries a sync frame, never touches the store and never records that it happened
//! (`lastSeen` stays what sync wrote). Nothing here logs: no key, text, coordinate or time.

pub mod wire;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub mod limits;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub mod remote;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub mod session;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub mod sink;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub use remote::{ControlError, FileSwitch, MasterSwitch, MemorySwitch, Remote, Status};
#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub use sink::{Action, InputSink, NoSink};

#[cfg(all(test, not(any(target_os = "android", target_os = "ios"))))]
pub(crate) mod tests;
