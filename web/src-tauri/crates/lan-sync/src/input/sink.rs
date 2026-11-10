//! The boundary between the hub and whatever acts on the PC. The hub decides (gate, limits) and
//! hands over typed actions; the sink never sees a network byte and never decides.
//!
//! Contract for an implementation (the Windows one lives in `crates/remote-input`, wired by the
//! shell): every method returns at once (a worker thread behind it does the system calls), and it
//! logs nothing.

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
    /// The last known state (cached; must not block).
    fn state(&self) -> PcState;
    /// Does it. Only called for an action that passed the gate and the limits.
    fn apply(&self, action: Action);
    /// An input session ended: let go of every button and key that is still held.
    fn release_all(&self);
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
    fn release_all(&self) {}
}
