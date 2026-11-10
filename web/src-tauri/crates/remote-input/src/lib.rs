//! What the remote control does on this PC (rule: `docs/rules/remote-control.md`).
//!
//! This crate is the far end of a deliberately narrow pipe. The LAN hub (`crates/lan-sync`) decides
//! who may do what; the shell forwards what passed as one of the typed [`Command`]s below; this
//! crate makes the system calls. It knows no network, no device and no grant, and the hub knows no
//! system call: *the crate that listens cannot act, the crate that acts cannot listen.*
//!
//! In this package there is the media level only, and it is made of API calls – the audio
//! endpoint's volume, the system's media session, `LockWorkStation`. **Nothing here simulates
//! input**: no `SendInput`, no media or volume key. (Pointer and keyboard come with their own
//! packages, and with them the first simulated input.)
//!
//! * One worker thread owns every system object (COM and WinRT are initialised there). Commands
//!   reach it through a bounded channel that never blocks the caller: when it is full, the command
//!   is dropped.
//! * [`Worker::state`] answers from a cache. The worker refreshes the cache when asked and after
//!   every command; nobody asking means no polling at all, and asking never waits: a reading
//!   older than [`STALE`] is answered "unknown" until the refresh is there.
//! * Nothing is logged, counted or stored.
//! * Not Windows: [`Worker::supported`] is `false`, every command is ignored.

#![cfg_attr(not(windows), forbid(unsafe_code))]

mod system;
mod worker;

pub use system::System;
pub use worker::{Worker, STALE};

/// One thing the remote control may ask of this PC. A fixed list; there is no "any key".
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Command {
    PlayPause,
    Next,
    Previous,
    /// One step up; also lifts a mute.
    VolumeUp,
    /// One step down.
    VolumeDown,
    MuteToggle,
    /// Locks the PC. There is no unlock.
    Lock,
}

/// What this PC says about itself: these four facts and nothing else.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct State {
    /// 0..=100; `None` when there is no audio device or it cannot be read.
    pub volume: Option<u8>,
    pub mute: bool,
    /// Whether the system's current media session is playing.
    pub playing: bool,
    /// `true` also when the lock state cannot be read: what cannot be told is treated as locked.
    pub locked: bool,
}

impl State {
    /// Before the first reading.
    pub const UNKNOWN: State = State {
        volume: None,
        mute: false,
        playing: false,
        locked: true,
    };
}

/// One volume step, as a fraction of the full range.
pub const VOLUME_STEP: f32 = 0.02;

/// The volume after one step, kept inside 0..=1.
pub fn stepped(volume: f32, up: bool) -> f32 {
    let v = if volume.is_finite() { volume } else { 0.0 };
    (if up { v + VOLUME_STEP } else { v - VOLUME_STEP }).clamp(0.0, 1.0)
}

/// A volume scalar as whole percent (rounded, 0..=100).
pub fn percent(volume: f32) -> u8 {
    if !volume.is_finite() {
        return 0;
    }
    (volume.clamp(0.0, 1.0) * 100.0).round() as u8
}
