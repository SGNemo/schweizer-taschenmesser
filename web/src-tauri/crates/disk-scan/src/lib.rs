//! Read-only disk scanning for the "Datenträger" module.
//!
//! No Tauri in here: the shell wraps these functions in commands (`src/disk_scan.rs`), so the
//! logic is testable on any machine. Nothing in this crate modifies the file system.

mod drives;
mod kinds;
mod scan;
mod tree;

pub use drives::{list_drives, DriveInfo, DriveKind, Media};
pub use kinds::{classify, FileKind, KIND_COUNT};
pub use scan::{scan, NotRead, Progress, ScanControl, ScanOptions, ScanResult};
pub use tree::{NodeKind, NodeView, Query, QueryScope, Tree};
