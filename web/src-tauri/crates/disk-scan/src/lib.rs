//! Read-only disk scanning for the "Datenträger" module.
//!
//! No Tauri in here: the shell wraps these functions in commands (`src/disk_scan.rs`), so the
//! logic is testable on any machine. Nothing in this crate modifies the file system.

mod delete;
mod drives;
mod duplicates;
mod guard;
mod kinds;
mod scan;
mod sizes;
mod system;
#[cfg(windows)]
mod trash_win;
mod tree;

pub use delete::{
    apply_to_tree, execute, plan, platform_trasher, DeleteControl, DeleteProgress, EntryError,
    Flag, ItemReport, Mode, NoTrash, Outcome, Plan, PlanItem, Report, TrashError, Trasher,
    LARGE_BYTES, LARGE_FILES,
};
pub use drives::{list_drives, Bus, DriveInfo, DriveKind, Health, HealthGap, HealthStatus, Media};
pub use duplicates::{find_duplicates, DupGroup};
pub use guard::{Denied, Guard, Norm};
pub use kinds::{classify, FileKind, KIND_COUNT};
pub use scan::{scan, NotRead, Progress, ScanControl, ScanOptions, ScanResult};
pub use sizes::{folder_size, place_sizes, recycle_bin_size, PlaceSize};
pub use system::{
    drive_kind_of, known_places, reveal_in_file_manager, running_programs, system_guard,
    user_data_dirs, Place,
};
pub use tree::{NodeKind, NodeView, Query, QueryScope, Tree};
