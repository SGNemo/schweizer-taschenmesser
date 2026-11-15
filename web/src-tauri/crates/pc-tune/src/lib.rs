//! PC care for the "Dieser PC" module (Windows): what was changed and how to take it back.
//!
//! No Tauri in here. Three rules shape the crate:
//! - **Everything is reversible.** A change is only made together with a journal entry that holds
//!   the value from before ([`journal`]); "Rückgängig" and "Alle zurücksetzen" replay those values.
//! - **Only the user's own settings.** The registry seam ([`reg`]) can write below
//!   `HKCU\Software` and nowhere else; machine-wide keys are read-only by construction, so nothing
//!   here needs or keeps administrator rights.
//! - **Nothing runs by itself.** Every function is a direct answer to a click; there is no
//!   schedule, no background work and no logging of values.

pub mod journal;
pub mod reg;
pub mod tools;

pub use journal::{
    apply_undo, ChangeError, Entry, EntryView, Journal, JournalError, Kind, Undo, MAX_ENTRIES,
};
pub use reg::{valid_key, MemRegistry, RegError, Registry, Value};
pub use tools::Tool;

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
