//! PC care for the "Dieser PC" module (Windows): what was changed and how to take it back.
//!
//! No Tauri in here. Three rules shape the crate:
//! - **Everything is reversible.** A change is only made together with a journal entry that holds
//!   the value from before ([`journal`]); "Rückgängig" and "Alle zurücksetzen" replay those values.
//! - **Only the user's own settings.** The registry seam ([`reg`]) can write below
//!   `HKCU\Software` and nowhere else; machine-wide keys are read-only by construction, so nothing
//!   here needs or keeps administrator rights.
//! - **Nothing runs by itself.** Every change is a direct answer to a click; the only thing done
//!   without one is reading (the lists, and [`health`] when the drives tab opens). There is no
//!   schedule, no background work and no logging of values.

pub mod health;
pub mod journal;
pub mod reg;
pub mod startup;
pub mod tools;
pub mod tweaks;

pub use journal::{
    apply_undo, cleanup_view, ChangeError, Entry, EntryView, Journal, JournalError, Kind, Undo,
    MAX_ENTRIES,
};
pub use reg::{valid_key, writable, MemRegistry, RegError, Registry, Value, WRITABLE};
pub use tools::{Home, Tool};
pub use tweaks::{system_effects, Effects, MemEffects, Target, TweakError, TweakState};

/// The registry of this machine; `None` where there is none (Linux, macOS).
pub fn system_registry() -> Option<Box<dyn Registry>> {
    #[cfg(windows)]
    {
        Some(Box::new(reg::WinRegistry))
    }
    #[cfg(not(windows))]
    {
        None
    }
}

/// Whether the care functions exist on this system (Windows only).
pub const SUPPORTED: bool = cfg!(windows);
