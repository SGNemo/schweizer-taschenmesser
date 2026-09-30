//! Disk module (desktop only): the thin Tauri side around the `disk_scan` crate.
//!
//! The scan tree stays in Rust; the webview only receives views of it (`disk_children`,
//! `disk_query`) and refers to entries by node id, never by path. Everything here is read-only.
//! Scans are kept in memory per session (at most `MAX_KEPT`), nothing is written to disk.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use ::disk_scan::{
    list_drives, scan, DriveInfo, NodeView, NotRead, Progress, Query, ScanControl, ScanOptions,
    Tree,
};
use serde::Serialize;
use tauri::{ipc::Channel, State};

/// Finished scans kept in memory; the oldest is dropped when a new one starts.
const MAX_KEPT: usize = 3;

#[derive(Default)]
pub struct DiskScans(Mutex<Inner>);

#[derive(Default)]
struct Inner {
    next_id: u64,
    scans: HashMap<u64, Arc<Session>>,
}

struct Session {
    control: ScanControl,
    tree: Mutex<Option<Arc<Tree>>>,
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

fn tree_of(state: &DiskScans, scan_id: u64) -> Result<Arc<Tree>, String> {
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
        let session = Arc::new(Session {
            control: ScanControl::default(),
            tree: Mutex::new(None),
        });
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
                    let tree = Arc::new(r.tree);
                    let root_node = tree.view(tree.root_id()).expect("a tree always has a root");
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
    Ok(tree_of(&state, scan_id)?.children(node, depth.clamp(1, 6), min_bytes))
}

#[tauri::command]
pub fn disk_node(
    state: State<'_, DiskScans>,
    scan_id: u64,
    node: u32,
) -> Result<Option<NodeView>, String> {
    Ok(tree_of(&state, scan_id)?.view(node))
}

#[tauri::command]
pub fn disk_query(
    state: State<'_, DiskScans>,
    scan_id: u64,
    query: Query,
) -> Result<Vec<NodeView>, String> {
    Ok(tree_of(&state, scan_id)?.query(&query))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn session() -> Arc<Session> {
        Arc::new(Session {
            control: ScanControl::default(),
            tree: Mutex::new(None),
        })
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
