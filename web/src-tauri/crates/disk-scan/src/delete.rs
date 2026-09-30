//! Deleting scanned entries: plan first, then execute. Everything is re-checked against the block
//! list right before it is touched, links are never followed, and the tree is corrected in place
//! afterwards (no rescan).

use crate::guard::{Denied, Guard, Norm};
use crate::kinds::FileKind;
use crate::tree::{NodeKind, Tree};
use serde::Serialize;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering::Relaxed};

/// Above this a deletion counts as large and needs the name typed in.
pub const LARGE_BYTES: u64 = 10 * 1024 * 1024 * 1024;
pub const LARGE_FILES: u64 = 10_000;
const MAX_ERRORS: usize = 50;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Mode {
    /// Recycle bin (the default).
    Trash,
    /// Gone for good; only ever chosen deliberately, with an extra confirmation.
    Permanent,
}

#[derive(Debug)]
pub enum TrashError {
    /// The recycle bin cannot take this item (network drive, too big, no bin on the volume).
    Unavailable,
    Failed(&'static str),
}

/// Moves one item to the recycle bin. Implemented by the OS shell on Windows; tests use a mock.
pub trait Trasher: Sync {
    fn trash(&self, path: &Path) -> Result<(), TrashError>;
}

/// The default `Trasher` of this platform.
pub fn platform_trasher() -> Box<dyn Trasher> {
    #[cfg(windows)]
    {
        Box::new(crate::trash_win::ShellTrasher)
    }
    #[cfg(not(windows))]
    {
        Box::new(NoTrash)
    }
}

/// Platforms without a supported recycle bin: everything is "unavailable", never silently permanent.
pub struct NoTrash;
impl Trasher for NoTrash {
    fn trash(&self, _path: &Path) -> Result<(), TrashError> {
        Err(TrashError::Unavailable)
    }
}

/// Extra warnings a plan item carries (the UI words them).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Flag {
    /// More than `LARGE_FILES` files or `LARGE_BYTES` bytes.
    Large,
    /// Inside Documents, Pictures, Desktop, Videos or Music.
    UserData,
    /// A program: an executable, or a folder containing executables/libraries.
    Program,
}

pub struct PlanItem {
    pub node: u32,
    pub path: PathBuf,
    pub name: String,
    pub is_dir: bool,
    pub bytes: u64,
    pub files: u64,
    pub flags: Vec<Flag>,
}

pub struct Plan {
    pub items: Vec<PlanItem>,
    pub denied: Vec<(u32, Denied)>,
}

impl Plan {
    pub fn total_bytes(&self) -> u64 {
        self.items.iter().map(|i| i.bytes).sum()
    }
    pub fn total_files(&self) -> u64 {
        self.items.iter().map(|i| i.files).sum()
    }
    pub fn is_large(&self) -> bool {
        self.total_bytes() > LARGE_BYTES || self.total_files() > LARGE_FILES
    }

    /// What has to be typed before this plan may run in `mode`: the entry's name (one entry) or
    /// `LÖSCHEN` (several). `None` when a plain confirmation is enough.
    pub fn required_confirmation(&self, mode: Mode) -> Option<String> {
        if mode == Mode::Permanent
            || self.is_large()
            || self.items.iter().any(|i| i.flags.contains(&Flag::Large))
        {
            Some(match self.items.as_slice() {
                [only] => only.name.clone(),
                _ => "LÖSCHEN".to_string(),
            })
        } else {
            None
        }
    }
}

/// Checks the selected nodes against the block list and collects what would be deleted. Selected
/// entries inside another selected folder are dropped (the folder covers them).
pub fn plan(tree: &Tree, guard: &Guard, user_dirs: &[String], nodes: &[u32]) -> Plan {
    let mut unique: Vec<u32> = Vec::new();
    for &n in nodes {
        if !unique.contains(&n) {
            unique.push(n);
        }
    }
    let user: Vec<Norm> = user_dirs
        .iter()
        .map(|d| Norm::parse(d, cfg!(windows)))
        .collect();
    let mut items = Vec::new();
    let mut denied = Vec::new();
    for &id in &unique {
        let Some(v) = tree.view(id) else {
            denied.push((id, Denied::Missing));
            continue;
        };
        if id == tree.root_id() {
            denied.push((id, Denied::ScanRoot));
            continue;
        }
        if v.kind == NodeKind::Small {
            denied.push((id, Denied::NotAnEntry));
            continue;
        }
        let Some(path) = tree.path(id) else {
            denied.push((id, Denied::NotAnEntry));
            continue;
        };
        let resolved = match guard.check_path(&path) {
            Ok(p) => p,
            Err(d) => {
                denied.push((id, d));
                continue;
            }
        };
        let mut flags = Vec::new();
        if v.bytes > LARGE_BYTES || v.files > LARGE_FILES {
            flags.push(Flag::Large);
        }
        let norm = Norm::parse(&resolved.to_string_lossy(), cfg!(windows));
        if user.iter().any(|u| norm.starts_with_norm(u)) {
            flags.push(Flag::UserData);
        }
        let is_dir = v.kind == NodeKind::Dir;
        let program = v.kind_bytes[FileKind::Program.index()] > 0;
        if program {
            flags.push(Flag::Program);
        }
        items.push(PlanItem {
            node: id,
            path: resolved,
            name: v.name,
            is_dir,
            bytes: v.bytes,
            files: v.files,
            flags,
        });
    }
    // Entries inside another *approved* entry are covered by it. (Decided after the block list, so a
    // refused parent never swallows its children: they get their own verdict.)
    let covered: Vec<u32> = items
        .iter()
        .filter(|a| {
            items
                .iter()
                .any(|b| b.node != a.node && tree.is_under(a.node, b.node))
        })
        .map(|a| a.node)
        .collect();
    items.retain(|i| !covered.contains(&i.node));
    Plan { items, denied }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Outcome {
    Deleted,
    /// Some files went, some could not (see `errors`); the folder may still exist.
    Partial,
    Failed,
    /// Refused by the block list (or the path changed since the plan).
    Skipped,
    /// Trash mode: the recycle bin cannot take it; nothing was deleted.
    TrashUnavailable,
    /// The run was cancelled before this entry.
    Cancelled,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryError {
    pub path: String,
    /// `in-use`, `denied` or `other`.
    pub reason: &'static str,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemReport {
    pub node: u32,
    pub name: String,
    pub outcome: Outcome,
    /// Why it was skipped or failed (`Denied::code()`, `changed`, or an error reason).
    pub reason: Option<&'static str>,
    pub files_deleted: u64,
    pub bytes: u64,
    pub errors: Vec<EntryError>,
    pub errors_total: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    pub mode: Mode,
    pub items: Vec<ItemReport>,
    pub cancelled: bool,
    pub files_deleted: u64,
    /// Space given back (from the scan sizes of fully deleted entries).
    pub freed_bytes: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteProgress {
    pub items_done: usize,
    pub items_total: usize,
    pub current: String,
    pub files_deleted: u64,
}

#[derive(Default)]
pub struct DeleteControl {
    cancel: AtomicBool,
}
impl DeleteControl {
    pub fn cancel(&self) {
        self.cancel.store(true, Relaxed);
    }
    pub fn is_cancelled(&self) -> bool {
        self.cancel.load(Relaxed)
    }
}

fn reason_of(e: &io::Error) -> &'static str {
    #[cfg(windows)]
    if matches!(e.raw_os_error(), Some(32 | 33)) {
        return "in-use";
    }
    #[cfg(unix)]
    if matches!(e.raw_os_error(), Some(16 | 26)) {
        return "in-use";
    }
    if e.kind() == io::ErrorKind::PermissionDenied {
        "denied"
    } else {
        "other"
    }
}

struct Run<'a> {
    control: &'a DeleteControl,
    files: AtomicU64,
    errors: std::sync::Mutex<Vec<EntryError>>,
    errors_total: AtomicU64,
    on_file: &'a (dyn Fn(u64) + Sync),
}

impl Run<'_> {
    fn fail(&self, path: &Path, e: &io::Error) {
        self.errors_total.fetch_add(1, Relaxed);
        let mut list = self.errors.lock().unwrap_or_else(|x| x.into_inner());
        if list.len() < MAX_ERRORS {
            list.push(EntryError {
                path: path.to_string_lossy().into_owned(),
                reason: reason_of(e),
            });
        }
    }
}

/// Removes a file or link. A read-only file is made writable once (Windows refuses otherwise).
fn remove_file_or_link(path: &Path) -> io::Result<()> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(e) => {
            // A directory link (Windows) is removed with remove_dir.
            if let Ok(md) = fs::symlink_metadata(path) {
                if md.file_type().is_symlink() && fs::remove_dir(path).is_ok() {
                    return Ok(());
                }
                if e.kind() == io::ErrorKind::PermissionDenied {
                    let mut perms = md.permissions();
                    if perms.readonly() {
                        #[allow(clippy::permissions_set_readonly_false)]
                        perms.set_readonly(false);
                        if fs::set_permissions(path, perms).is_ok() {
                            return fs::remove_file(path);
                        }
                    }
                }
            }
            Err(e)
        }
    }
}

/// Deletes `path` bottom-up without ever following a link; keeps going after single failures.
/// Returns true when `path` itself is gone.
fn remove_tree(path: &Path, run: &Run) -> bool {
    if run.control.is_cancelled() {
        return false;
    }
    let md = match fs::symlink_metadata(path) {
        Ok(m) => m,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return true,
        Err(e) => {
            run.fail(path, &e);
            return false;
        }
    };
    if md.file_type().is_symlink() || !md.is_dir() {
        return match remove_file_or_link(path) {
            Ok(()) => {
                (run.on_file)(run.files.fetch_add(1, Relaxed) + 1);
                true
            }
            Err(e) => {
                run.fail(path, &e);
                false
            }
        };
    }
    let mut all_gone = true;
    match fs::read_dir(path) {
        Ok(rd) => {
            for entry in rd {
                match entry {
                    Ok(e) => all_gone &= remove_tree(&e.path(), run),
                    Err(e) => {
                        run.fail(path, &e);
                        all_gone = false;
                    }
                }
            }
        }
        Err(e) => {
            run.fail(path, &e);
            return false;
        }
    }
    if !all_gone || run.control.is_cancelled() {
        return false;
    }
    match fs::remove_dir(path) {
        Ok(()) => true,
        Err(e) if e.kind() == io::ErrorKind::NotFound => true,
        Err(e) => {
            run.fail(path, &e);
            false
        }
    }
}

/// Runs a plan. `guard` must be fresh (running programs refreshed): every entry is checked again
/// and must still resolve to the path that was planned.
pub fn execute(
    plan: &Plan,
    mode: Mode,
    guard: &Guard,
    trasher: &dyn Trasher,
    control: &DeleteControl,
    on_progress: &(dyn Fn(DeleteProgress) + Sync),
) -> Report {
    let total = plan.items.len();
    let files_total = AtomicU64::new(0);
    let mut items = Vec::new();
    let mut freed = 0u64;
    let base = |it: &PlanItem, outcome, reason| ItemReport {
        node: it.node,
        name: it.name.clone(),
        outcome,
        reason,
        files_deleted: 0,
        bytes: 0,
        errors: Vec::new(),
        errors_total: 0,
    };
    for (i, it) in plan.items.iter().enumerate() {
        on_progress(DeleteProgress {
            items_done: i,
            items_total: total,
            current: it.name.clone(),
            files_deleted: files_total.load(Relaxed),
        });
        if control.is_cancelled() {
            items.push(base(it, Outcome::Cancelled, None));
            continue;
        }
        match guard.check_path(&it.path) {
            Err(d) => {
                items.push(base(it, Outcome::Skipped, Some(d.code())));
                continue;
            }
            Ok(now) if now != it.path => {
                items.push(base(it, Outcome::Skipped, Some("changed")));
                continue;
            }
            Ok(_) => {}
        }
        match mode {
            Mode::Trash => match trasher.trash(&it.path) {
                Ok(()) => {
                    freed += it.bytes;
                    files_total.fetch_add(it.files, Relaxed);
                    let mut r = base(it, Outcome::Deleted, None);
                    r.files_deleted = it.files;
                    r.bytes = it.bytes;
                    items.push(r);
                }
                Err(TrashError::Unavailable) => {
                    items.push(base(it, Outcome::TrashUnavailable, None))
                }
                Err(TrashError::Failed(code)) => items.push(base(it, Outcome::Failed, Some(code))),
            },
            Mode::Permanent => {
                let name = it.name.clone();
                let ft = &files_total;
                let progress = move |n: u64| {
                    if n % 200 == 0 {
                        on_progress(DeleteProgress {
                            items_done: i,
                            items_total: total,
                            current: name.clone(),
                            files_deleted: ft.load(Relaxed) + n,
                        });
                    }
                };
                let run = Run {
                    control,
                    files: AtomicU64::new(0),
                    errors: std::sync::Mutex::new(Vec::new()),
                    errors_total: AtomicU64::new(0),
                    on_file: &progress,
                };
                let gone = remove_tree(&it.path, &run);
                let n = run.files.load(Relaxed);
                files_total.fetch_add(n, Relaxed);
                let errors = run.errors.into_inner().unwrap_or_else(|x| x.into_inner());
                let errors_total = run.errors_total.load(Relaxed);
                let outcome = if gone {
                    freed += it.bytes;
                    Outcome::Deleted
                } else if control.is_cancelled() {
                    Outcome::Cancelled
                } else if n > 0 {
                    Outcome::Partial
                } else {
                    Outcome::Failed
                };
                items.push(ItemReport {
                    node: it.node,
                    name: it.name.clone(),
                    outcome,
                    reason: errors.first().map(|e| e.reason),
                    files_deleted: n,
                    bytes: if gone { it.bytes } else { 0 },
                    errors,
                    errors_total,
                });
            }
        }
    }
    on_progress(DeleteProgress {
        items_done: total,
        items_total: total,
        current: String::new(),
        files_deleted: files_total.load(Relaxed),
    });
    Report {
        mode,
        items,
        cancelled: control.is_cancelled(),
        files_deleted: files_total.load(Relaxed),
        freed_bytes: freed,
    }
}

/// Corrects the scan tree after a run: fully deleted entries disappear and their sums are taken
/// off every folder above. Partial results stay (the numbers may then be too high).
pub fn apply_to_tree(tree: &mut Tree, report: &Report) {
    for it in &report.items {
        if it.outcome == Outcome::Deleted {
            tree.remove(it.node);
        }
    }
}
