//! The boundary between the hub and whatever acts on the PC. The hub decides (gate, limits) and
//! hands over typed actions; the sink never sees a network byte and never decides.
//!
//! Contract for an implementation (the Windows one lives in `crates/remote-input`, wired by the
//! shell): every method returns at once (a worker thread behind it does the system calls) – except
//! `state()` after a quiet time, which may wait a bounded moment (see [`InputSink::state`]) – and
//! it logs nothing.

use super::wire::{Button, Key, Media, PcState, Record};
use std::fmt;

/// One thing to do on the PC. `Text` holds what the user typed: it is never formatted (`Debug` is
/// redacted for every variant) and never stored.
#[derive(Clone, PartialEq, Eq)]
pub enum Action {
    Move { dx: i8, dy: i8 },
    Button { button: Button, down: bool },
    Scroll { dx: i8, dy: i8 },
    Key(Key),
    Media(Media),
    Text(String),
}

impl fmt::Debug for Action {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("Action(..)")
    }
}

impl From<Record> for Action {
    fn from(r: Record) -> Action {
        match r {
            Record::Move { dx, dy } => Action::Move { dx, dy },
            Record::Button { button, down } => Action::Button { button, down },
            Record::Scroll { dx, dy } => Action::Scroll { dx, dy },
            Record::Key(k) => Action::Key(k),
            Record::Media(m) => Action::Media(m),
        }
    }
}

pub trait InputSink: Send + Sync {
    /// Whether this PC can be controlled at all (`false`: every `open` is answered `unsupported`).
    fn supported(&self) -> bool;
    /// The last known state, from a cache. While a session polls, this returns at once; the first
    /// call after a quiet time (the `open` of a session) may wait a bounded moment – well under a
    /// second – for a fresh reading, so an `open` is not answered from a stale "unknown".
    fn state(&self) -> PcState;
    /// Does it. Only called for an action that passed the gate and the limits – and, when a
    /// session ends, for the release of each mouse button that session still held. A key is
    /// pressed and released within one `apply`, so a mouse button is all that can stay held.
    fn apply(&self, action: Action);
}

/// The sink of a PC that cannot be controlled (not Windows, or nothing wired yet).
pub struct NoSink;

impl InputSink for NoSink {
    fn supported(&self) -> bool {
        false
    }
    fn state(&self) -> PcState {
        PcState::UNKNOWN
    }
    fn apply(&self, _action: Action) {}
}
