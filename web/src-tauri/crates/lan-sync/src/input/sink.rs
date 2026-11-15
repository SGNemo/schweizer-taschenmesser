//! The boundary between the hub and whatever acts on the PC. The hub decides (gate, limits) and
//! hands over typed actions; the sink never sees a network byte and never decides.
//!
//! Contract for an implementation (the Windows one lives in `crates/remote-input`, wired by the
//! shell): every method returns at once (a worker thread behind it does the system calls) – except
//! `state()` after a quiet time, which may wait a bounded moment (see [`InputSink::state`]) – and
//! it logs nothing.

use super::wire::{Button, Key, Media, PcState, Power, PowerAnswer, ProgramAnswer, Record};
use crate::noise::PublicKey;
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

    /// A power action of `device` that passed the gate (session, permission, PC not locked,
    /// limits) – or `Cancel`, which always passes. The sink owns the countdown (one for the whole
    /// PC) and its own per-device limit, and answers at once; it never acts before the countdown
    /// ran out. `despite`: start although Nemo on the PC is still working.
    fn power(&self, device: &PublicKey, power: Power, despite: bool) -> PowerAnswer {
        let _ = (device, despite);
        match power {
            Power::Cancel => PowerAnswer::Cancelled,
            _ => PowerAnswer::Failed,
        }
    }

    /// (a countdown runs, hibernate is available) – for the `opened` of a session.
    fn power_info(&self) -> (bool, bool) {
        (false, false)
    }

    /// The latest thing that happened to a countdown without a question (it ran out, or it was
    /// stopped at the PC): a number that grows with every such news, whose countdown it was, and
    /// the answer. A session tells its phone the news of its device that came after it opened.
    fn power_news(&self) -> Option<(u64, PublicKey, PowerAnswer)> {
        None
    }

    /// The names of the PC's program list in slot order, and a number that changes with every
    /// change of the list. Names only: never a path.
    fn programs(&self) -> (u64, Vec<String>) {
        (0, Vec::new())
    }

    /// Starts the program in `slot` of the PC's list – a start that passed the gate (session,
    /// permission, PC not locked, limits, the slot exists). `list`: the number of the list the
    /// phone was told; when the list changed since, nothing starts (`Failed`). The path is the
    /// PC's, looked up now; it starts without arguments. Answers at once.
    fn start_program(&self, slot: u8, list: u64) -> ProgramAnswer {
        let _ = (slot, list);
        ProgramAnswer::Failed
    }
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
