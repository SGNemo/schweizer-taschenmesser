//! Device exchange: messages, links and (package 2) files between a paired phone and this PC
//! (concept `docs/design/device-exchange/CONCEPT.md`). **Pairing is not permission.**
//!
//! * `wire`: the frames of an exchange session (both sides, every target).
//! * `control` (hub): the PC's switch ("module on at this PC") and the per-device grant, read by
//!   the session and changed only by the PC's own controls – never by a frame from the network –,
//!   plus the boundaries to the shell: the inbox (where an item is stored before it is acked) and
//!   the outbox (what the PC queued for a device).
//! * `session` (hub): one exchange connection – `hello`, `open`, then items both ways, one PC → phone
//!   item in flight at a time, each removed from the outbox only after the phone's `ack`.
//!
//! An exchange session is its own handshake mode (`noise::Mode::Exchange`) on the hub's listener,
//! accepted only on the stored home network: it never carries a sync or input frame, never touches
//! the store, records no activity (`lastSeen` stays sync contact) and logs nothing.

pub mod wire;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub mod control;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub mod session;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub use control::{
    Exchange, ExchangeInbox, ExchangeOutbox, InboxFull, MemoryInbox, MemoryOutbox,
};

#[cfg(all(test, not(any(target_os = "android", target_os = "ios"))))]
mod tests;
