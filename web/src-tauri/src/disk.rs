//! Disk module (desktop only): the thin Tauri side around the `disk_scan` crate.
//!
//! The scan tree stays in Rust; the webview only receives views of it (`disk_children`,
//! `disk_query`) and refers to entries by node id, never by path. Everything here is read-only.
//! Scans are kept in memory per session (at most `MAX_KEPT`), nothing is written to disk.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, Instant};

use ::disk_scan::{
    apply_to_tree, drive_kind_of, execute, find_duplicates, known_places, list_drives, plan,
    platform_trasher, reveal_in_file_manager, scan, system_guard, user_data_dirs, DeleteControl,
    DeleteProgress, Denied, DriveInfo, DriveKind, DupGroup, Flag, Mode, NodeView, NotRead, Place,
    Plan, Progress, Query, Report, ScanControl, ScanOptions, Tree,
};
use serde::Serialize;
use tauri::{ipc::Channel, AppHandle, Manager, State};

/// Finished scans kept in memory; the oldest is dropped when a new one starts.
const MAX_KEPT: usize = 3;
/// A delete plan must be confirmed within this time, otherwise it is void.
const PLAN_TTL: Duration = Duration::from_secs(5 * 60);
const MAX_PLANS: usize = 8;

#[derive(Default)]
pub struct DiskScans(Arc<Mutex<Inner>>);

#[derive(Default)]
struct Inner {
    next_id: u64,
    scans: HashMap<u64, Arc<Session>>,
    plans: HashMap<u64, Arc<StoredPlan>>,
}

struct Session {
    control: ScanControl,
    /// Set once the scan finished. Writes only happen after a delete run (tree correction).
    tree: Mutex<Option<Arc<RwLock<Tree>>>>,
    dup_control: Mutex<Arc<ScanControl>>,
}

struct StoredPlan {
    scan_id: u64,
    plan: Plan,
    created: Instant,
    control: DeleteControl,
    running: std::sync::atomic::AtomicBool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Summary {
    scan_id: u64,
    root: String,
    root_node: NodeView,
    cancelled: bool,
    files: u64,
    dirs: u64,
    bytes: u64,
    logical_bytes: u64,
    cloud_bytes: u64,
    skipped_links: u64,
    not_read: Vec<NotRead>,
    not_read_total: u64,
    elapsed_ms: u64,
}

#[derive(Serialize)]
#[serde(tag = "event", rename_all = "camelCase")]
pub enum ScanEvent {
    Progress(Progress),
    Done(Box<Summary>),
    Failed { reason: String },
}

impl Inner {
    fn get(&self, id: u64) -> Result<Arc<Session>, String> {
        self.scans
            .get(&id)
            .cloned()
            .ok_or_else(|| "unknown-scan".to_string())
    }

    /// Makes room for a new scan by dropping the oldest ones.
    fn evict(&mut self) {
        while self.scans.len() >= MAX_KEPT {
            let Some(&oldest) = self.scans.keys().min() else {
                break;
            };
            if let Some(s) = self.scans.remove(&oldest) {
                s.control.cancel();
            }
        }
    }
}

fn new_session() -> Session {
    Session {
        control: ScanControl::default(),
        tree: Mutex::new(None),
        dup_control: Mutex::new(Arc::new(ScanControl::default())),
    }
}

fn read(t: &Arc<RwLock<Tree>>) -> std::sync::RwLockReadGuard<'_, Tree> {
    t.read().unwrap_or_else(|e| e.into_inner())
}

fn tree_of(state: &DiskScans, scan_id: u64) -> Result<Arc<RwLock<Tree>>, String> {
    let session = state.0.lock().map_err(|_| "internal")?.get(scan_id)?;
    let tree = session.tree.lock().map_err(|_| "internal")?.clone();
    tree.ok_or_else(|| "not-finished".to_string())
}

/// Drives with capacity. Network drives can be slow, so this runs off the main thread.
#[tauri::command]
pub async fn disk_list_drives() -> Result<Vec<DriveInfo>, String> {
    tauri::async_runtime::spawn_blocking(list_drives)
        .await
        .map_err(|_| "internal".to_string())
}

/// Starts a scan of a folder and returns its id at once; progress and the result arrive on the
/// channel (`progress` about every 100 ms, then `done` or `failed`).
#[tauri::command]
pub fn disk_scan_start(
    state: State<'_, DiskScans>,
    root: String,
    on_event: Channel<ScanEvent>,
) -> Result<u64, String> {
    if root.trim().is_empty() {
        return Err("bad-root".into());
    }
    let root = PathBuf::from(root);
    let (id, session) = {
        let mut inner = state.0.lock().map_err(|_| "internal")?;
        inner.evict();
        inner.next_id += 1;
        let id = inner.next_id;
        let session = Arc::new(new_session());
        inner.scans.insert(id, session.clone());
        (id, session)
    };
    std::thread::Builder::new()
        .name("disk-scan-main".into())
        .spawn(move || {
            let progress = on_event.clone();
            let result = scan(&root, &ScanOptions::default(), &session.control, move |p| {
                let _ = progress.send(ScanEvent::Progress(p));
            });
            let event = match result {
                Ok(r) => {
                    let tree = Arc::new(RwLock::new(r.tree));
                    let root_node = {
                        let t = tree.read().unwrap_or_else(|e| e.into_inner());
                        t.view(t.root_id()).expect("a tree always has a root")
                    };
                    if let Ok(mut slot) = session.tree.lock() {
                        *slot = Some(tree);
                    }
                    ScanEvent::Done(Box::new(Summary {
                        scan_id: id,
                        root: root.to_string_lossy().into_owned(),
                        root_node,
                        cancelled: r.cancelled,
                        files: r.files,
                        dirs: r.dirs,
                        bytes: r.bytes,
                        logical_bytes: r.logical_bytes,
                        cloud_bytes: r.cloud_bytes,
                        skipped_links: r.skipped_links,
                        not_read: r.not_read,
                        not_read_total: r.not_read_total,
                        elapsed_ms: r.elapsed_ms,
                    }))
                }
                Err(e) => ScanEvent::Failed {
                    reason: match e.kind() {
                        std::io::ErrorKind::NotFound => "not-found",
                        std::io::ErrorKind::PermissionDenied => "denied",
                        std::io::ErrorKind::InvalidInput => "not-a-folder",
                        _ => "error",
                    }
                    .to_string(),
                },
            };
            let _ = on_event.send(event);
        })
        .map_err(|_| "internal".to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn disk_scan_cancel(state: State<'_, DiskScans>, scan_id: u64) -> Result<(), String> {
    state
        .0
        .lock()
        .map_err(|_| "internal")?
        .get(scan_id)?
        .control
        .cancel();
    Ok(())
}

#[tauri::command]
pub fn disk_scan_pause(
    state: State<'_, DiskScans>,
    scan_id: u64,
    paused: bool,
) -> Result<(), String> {
    state
        .0
        .lock()
        .map_err(|_| "internal")?
        .get(scan_id)?
        .control
        .set_paused(paused);
    Ok(())
}

/// Forgets a scan (frees its memory).
#[tauri::command]
pub fn disk_scan_drop(state: State<'_, DiskScans>, scan_id: u64) -> Result<(), String> {
    if let Some(s) = state
        .0
        .lock()
        .map_err(|_| "internal")?
        .scans
        .remove(&scan_id)
    {
        s.control.cancel();
    }
    Ok(())
}

#[tauri::command]
pub fn disk_children(
    state: State<'_, DiskScans>,
    scan_id: u64,
    node: u32,
    depth: u32,
    min_bytes: u64,
) -> Result<Vec<NodeView>, String> {
    Ok(read(&tree_of(&state, scan_id)?).children(node, depth.clamp(1, 6), min_bytes))
}

#[tauri::command]
pub fn disk_node(
    state: State<'_, DiskScans>,
    scan_id: u64,
    node: u32,
) -> Result<Option<NodeView>, String> {
    Ok(read(&tree_of(&state, scan_id)?).view(node))
}

#[tauri::command]
pub fn disk_query(
    state: State<'_, DiskScans>,
    scan_id: u64,
    query: Query,
) -> Result<Vec<NodeView>, String> {
    Ok(read(&tree_of(&state, scan_id)?).query(&query))
}

// --- clean-up: places, duplicates, paths ------------------------------------------------------

/// Well-known cache and temp folders that exist here; the UI offers them as scan roots.
#[tauri::command]
pub fn disk_known_places() -> Vec<Place> {
    known_places()
}

/// Sizes of the well-known places, summed up with a bounded walk (no scan, nothing is changed).
#[tauri::command]
pub async fn disk_place_sizes() -> Result<Vec<::disk_scan::PlaceSize>, String> {
    tauri::async_runtime::spawn_blocking(::disk_scan::place_sizes)
        .await
        .map_err(|_| "internal".to_string())
}

/// Size of the recycle bin; `None` where it cannot be read. Emptying it stays a job for Explorer.
#[tauri::command]
pub async fn disk_recycle_size() -> Result<Option<u64>, String> {
    tauri::async_runtime::spawn_blocking(::disk_scan::recycle_bin_size)
        .await
        .map_err(|_| "internal".to_string())
}

/// Display form of a resolved path (no `\\?\` prefix).
fn display_path(p: &Path) -> String {
    let s = p.to_string_lossy();
    if let Some(rest) = s.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{rest}")
    } else {
        s.strip_prefix(r"\\?\").unwrap_or(&s).to_string()
    }
}

/// Full path of an entry (display only; deleting never takes a path from the webview).
#[tauri::command]
pub fn disk_node_path(
    state: State<'_, DiskScans>,
    scan_id: u64,
    node: u32,
) -> Result<String, String> {
    let tree = tree_of(&state, scan_id)?;
    let path = read(&tree).path(node).ok_or("not-an-entry")?;
    Ok(display_path(&path))
}

/// Shows the entry in Windows Explorer.
#[tauri::command]
pub fn disk_reveal(state: State<'_, DiskScans>, scan_id: u64, node: u32) -> Result<(), String> {
    let tree = tree_of(&state, scan_id)?;
    let path = read(&tree).path(node).ok_or("not-an-entry")?;
    reveal_in_file_manager(&path).map_err(|_| "unsupported".to_string())
}

#[derive(Serialize)]
#[serde(tag = "event", rename_all = "camelCase")]
pub enum DupEvent {
    Done { groups: Vec<DupGroup> },
    Failed { reason: String },
}

/// Looks for identical files below `under` (size, then a 64 KiB hash, then the full hash). Runs in
/// the background; the result arrives on the channel. Nothing is deleted.
#[tauri::command]
pub fn disk_find_duplicates(
    state: State<'_, DiskScans>,
    scan_id: u64,
    under: u32,
    on_event: Channel<DupEvent>,
) -> Result<(), String> {
    let tree = tree_of(&state, scan_id)?;
    let session = state.0.lock().map_err(|_| "internal")?.get(scan_id)?;
    let control = Arc::new(ScanControl::default());
    *session.dup_control.lock().map_err(|_| "internal")? = control.clone();
    std::thread::Builder::new()
        .name("disk-duplicates".into())
        .spawn(move || {
            let groups = find_duplicates(&read(&tree), under, &control);
            let _ = on_event.send(if control.is_cancelled() {
                DupEvent::Failed {
                    reason: "cancelled".into(),
                }
            } else {
                DupEvent::Done { groups }
            });
        })
        .map_err(|_| "internal".to_string())?;
    Ok(())
}

#[tauri::command]
pub fn disk_duplicates_cancel(state: State<'_, DiskScans>, scan_id: u64) -> Result<(), String> {
    let session = state.0.lock().map_err(|_| "internal")?.get(scan_id)?;
    session.dup_control.lock().map_err(|_| "internal")?.cancel();
    Ok(())
}

// --- deleting ---------------------------------------------------------------------------------

/// The block list of this machine, with the app's own folders added.
fn guard_for(app: &AppHandle) -> ::disk_scan::Guard {
    let path = app.path();
    let dirs: Vec<PathBuf> = [
        path.app_data_dir(),
        path.app_local_data_dir(),
        path.app_config_dir(),
        path.app_cache_dir(),
        path.app_log_dir(),
    ]
    .into_iter()
    .flatten()
    .collect();
    system_guard(&dirs)
}

/// Why an entry cannot be deleted, or `None` when it can. Cheap; the details view asks it so the
/// buttons are only offered for entries the block list allows.
#[tauri::command]
pub fn disk_can_delete(
    app: AppHandle,
    state: State<'_, DiskScans>,
    scan_id: u64,
    node: u32,
) -> Result<Option<String>, String> {
    let tree = tree_of(&state, scan_id)?;
    let g = guard_for(&app);
    let p = plan(&read(&tree), &g, &user_data_dirs(), &[node]);
    Ok(p.denied.first().map(|(_, d)| d.code().to_string()))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanItemView {
    node_id: u32,
    name: String,
    path: String,
    is_dir: bool,
    bytes: u64,
    files: u64,
    flags: Vec<Flag>,
    drive: DriveKind,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeniedView {
    node_id: u32,
    name: String,
    reason: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanView {
    plan_id: u64,
    items: Vec<PlanItemView>,
    denied: Vec<DeniedView>,
    total_bytes: u64,
    total_files: u64,
    large: bool,
    /// What has to be typed for a move to the recycle bin (`None` = a plain confirmation is enough).
    trash_confirmation: Option<String>,
    /// What has to be typed for a permanent delete (always required).
    permanent_confirmation: Option<String>,
    /// False when an item is on a network/removable drive, where the recycle bin often cannot be used.
    trash_likely: bool,
}

/// Checks the selected entries against the block list and returns what would be deleted. Nothing
/// is touched. The plan is valid for five minutes.
#[tauri::command]
pub fn disk_delete_plan(
    app: AppHandle,
    state: State<'_, DiskScans>,
    scan_id: u64,
    nodes: Vec<u32>,
) -> Result<PlanView, String> {
    if nodes.is_empty() || nodes.len() > 5000 {
        return Err("bad-selection".into());
    }
    let tree = tree_of(&state, scan_id)?;
    let g = guard_for(&app);
    let t = read(&tree);
    let p = plan(&t, &g, &user_data_dirs(), &nodes);
    let denied = p
        .denied
        .iter()
        .map(|(id, d): &(u32, Denied)| DeniedView {
            node_id: *id,
            name: t.view(*id).map(|v| v.name).unwrap_or_default(),
            reason: d.code(),
        })
        .collect();
    let items: Vec<PlanItemView> = p
        .items
        .iter()
        .map(|i| PlanItemView {
            node_id: i.node,
            name: i.name.clone(),
            path: display_path(&i.path),
            is_dir: i.is_dir,
            bytes: i.bytes,
            files: i.files,
            flags: i.flags.clone(),
            drive: drive_kind_of(&i.path),
        })
        .collect();
    drop(t);
    let view_base = (
        p.total_bytes(),
        p.total_files(),
        p.is_large(),
        p.required_confirmation(Mode::Trash),
        p.required_confirmation(Mode::Permanent),
    );
    let trash_likely = items.iter().all(|i| i.drive == DriveKind::Fixed);
    let mut inner = state.0.lock().map_err(|_| "internal")?;
    let now = Instant::now();
    inner
        .plans
        .retain(|_, s| now.duration_since(s.created) < PLAN_TTL);
    while inner.plans.len() >= MAX_PLANS {
        let Some(&oldest) = inner.plans.keys().min() else {
            break;
        };
        inner.plans.remove(&oldest);
    }
    inner.next_id += 1;
    let plan_id = inner.next_id;
    inner.plans.insert(
        plan_id,
        Arc::new(StoredPlan {
            scan_id,
            plan: p,
            created: now,
            control: DeleteControl::default(),
            running: std::sync::atomic::AtomicBool::new(false),
        }),
    );
    Ok(PlanView {
        plan_id,
        items,
        denied,
        total_bytes: view_base.0,
        total_files: view_base.1,
        large: view_base.2,
        trash_confirmation: view_base.3,
        permanent_confirmation: view_base.4,
        trash_likely,
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DoneView {
    #[serde(flatten)]
    report: Report,
    /// The scan root after the tree was corrected (totals moved).
    root_node: Option<NodeView>,
}

#[derive(Serialize)]
#[serde(tag = "event", rename_all = "camelCase")]
pub enum DeleteEvent {
    Progress(DeleteProgress),
    Done(Box<DoneView>),
}

/// Runs a confirmed plan. `mode` is `trash` or `permanent`; `confirm` must be the exact phrase the
/// plan asks for (checked here, not only in the UI). Progress and the report arrive on the channel.
#[tauri::command]
pub fn disk_delete(
    app: AppHandle,
    state: State<'_, DiskScans>,
    plan_id: u64,
    mode: String,
    confirm: Option<String>,
    on_event: Channel<DeleteEvent>,
) -> Result<(), String> {
    let mode = match mode.as_str() {
        "trash" => Mode::Trash,
        "permanent" => Mode::Permanent,
        _ => return Err("bad-mode".into()),
    };
    let stored = {
        let inner = state.0.lock().map_err(|_| "internal")?;
        inner.plans.get(&plan_id).cloned().ok_or("unknown-plan")?
    };
    if Instant::now().duration_since(stored.created) >= PLAN_TTL {
        return Err("plan-expired".into());
    }
    if let Some(expected) = stored.plan.required_confirmation(mode) {
        if confirm.as_deref().map(str::trim) != Some(expected.as_str()) {
            return Err("confirmation-mismatch".into());
        }
    }
    if stored
        .running
        .swap(true, std::sync::atomic::Ordering::SeqCst)
    {
        return Err("already-running".into());
    }
    let tree = tree_of(&state, stored.scan_id)?;
    let scans = state.0.clone();
    // Fresh guard (running programs re-read) right before anything is touched.
    let guard = guard_for(&app);
    std::thread::Builder::new()
        .name("disk-delete".into())
        .spawn(move || {
            let trasher = platform_trasher();
            let progress = on_event.clone();
            let report = execute(
                &stored.plan,
                mode,
                &guard,
                trasher.as_ref(),
                &stored.control,
                &move |p| {
                    let _ = progress.send(DeleteEvent::Progress(p));
                },
            );
            let root_node = {
                let mut t = tree.write().unwrap_or_else(|e| e.into_inner());
                apply_to_tree(&mut t, &report);
                t.view(t.root_id())
            };
            if let Ok(mut inner) = scans.lock() {
                inner.plans.remove(&plan_id);
            }
            let _ = on_event.send(DeleteEvent::Done(Box::new(DoneView { report, root_node })));
        })
        .map_err(|_| "internal".to_string())?;
    Ok(())
}

/// Stops a running delete after the current entry.
#[tauri::command]
pub fn disk_delete_cancel(state: State<'_, DiskScans>, plan_id: u64) -> Result<(), String> {
    let inner = state.0.lock().map_err(|_| "internal")?;
    inner
        .plans
        .get(&plan_id)
        .ok_or("unknown-plan")?
        .control
        .cancel();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn session() -> Arc<Session> {
        Arc::new(new_session())
    }

    #[test]
    fn the_oldest_scan_is_evicted_and_cancelled() {
        let mut inner = Inner::default();
        for id in 1..=MAX_KEPT as u64 {
            inner.scans.insert(id, session());
        }
        let oldest = inner.scans[&1].clone();
        inner.evict();
        assert_eq!(inner.scans.len(), MAX_KEPT - 1);
        assert!(!inner.scans.contains_key(&1));
        assert!(oldest.control.is_cancelled());
    }

    #[test]
    fn unknown_scans_are_an_error() {
        let inner = Inner::default();
        assert_eq!(inner.get(9).err().as_deref(), Some("unknown-scan"));
    }
}
