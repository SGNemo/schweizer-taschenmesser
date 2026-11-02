//! Downloads module (desktop only): thin wrapper around the `downloader` crate. The webview names a
//! folder (picked in the system dialog) and an address; files are only written there, never opened or
//! started. "Folder" shows the file in the file manager.

use std::{
    path::PathBuf,
    sync::{Arc, Mutex, OnceLock},
};

use ::downloader::{AddError, Job, Manager};
use tauri::{ipc::Channel, AppHandle, Manager as _, State};

#[derive(Default)]
pub struct Downloads {
    manager: OnceLock<Manager>,
    watchers: Arc<Mutex<Vec<Channel<Vec<Job>>>>>,
}

fn state_file(app: &AppHandle) -> Result<PathBuf, String> {
    #[cfg(windows)]
    if let Some(dir) = std::env::current_exe()
        .ok()
        .and_then(|exe| crate::portable::data_dir(&exe, &app.config().identifier))
    {
        return Ok(dir.join("downloads.json"));
    }
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|_| "internal".to_string())?;
    std::fs::create_dir_all(&dir).map_err(|_| "io".to_string())?;
    Ok(dir.join("downloads.json"))
}

impl Downloads {
    /// The manager is created on first use, so an app that never opens the module does nothing.
    fn manager(&self, app: &AppHandle) -> Result<&Manager, String> {
        if let Some(m) = self.manager.get() {
            return Ok(m);
        }
        let watchers = self.watchers.clone();
        let manager_cell: Arc<OnceLock<Manager>> = Arc::new(OnceLock::new());
        let cell = manager_cell.clone();
        let m = Manager::open(
            state_file(app)?,
            Arc::new(move || {
                let Some(m) = cell.get() else { return };
                let snapshot = m.snapshot();
                if let Ok(mut w) = watchers.lock() {
                    w.retain(|c| c.send(snapshot.clone()).is_ok());
                }
            }),
        );
        let _ = manager_cell.set(m.clone());
        Ok(self.manager.get_or_init(|| m))
    }
}

fn add_error(e: AddError) -> String {
    e.code().to_string()
}

/// Sends the current list now and after every change (about four times a second while downloading).
#[tauri::command]
pub fn downloads_watch(
    app: AppHandle,
    state: State<'_, Downloads>,
    events: Channel<Vec<Job>>,
) -> Result<(), String> {
    let manager = state.manager(&app)?;
    let _ = events.send(manager.snapshot());
    state
        .watchers
        .lock()
        .map_err(|_| "internal".to_string())?
        .push(events);
    Ok(())
}

/// The system's Downloads folder, as the default target.
#[tauri::command]
pub fn downloads_default_dir(app: AppHandle) -> Result<String, String> {
    let dir = app
        .path()
        .download_dir()
        .map_err(|_| "no-dir".to_string())?;
    Ok(dir.to_string_lossy().into_owned())
}

/// Adds a job. Nothing starts without this call: a download offered by a web page first shows the
/// address in the module and waits for a click.
#[tauri::command]
pub fn downloads_add(
    app: AppHandle,
    state: State<'_, Downloads>,
    url: String,
    dir: String,
    expected_hash: Option<String>,
) -> Result<Job, String> {
    state
        .manager(&app)?
        .add(&url, &PathBuf::from(dir), expected_hash.as_deref())
        .map_err(add_error)
}

#[tauri::command]
pub fn downloads_pause(app: AppHandle, state: State<'_, Downloads>, id: u64) -> Result<(), String> {
    state.manager(&app)?.pause(id);
    Ok(())
}

#[tauri::command]
pub fn downloads_resume(
    app: AppHandle,
    state: State<'_, Downloads>,
    id: u64,
) -> Result<(), String> {
    state.manager(&app)?.resume(id);
    Ok(())
}

#[tauri::command]
pub fn downloads_remove(
    app: AppHandle,
    state: State<'_, Downloads>,
    id: u64,
    delete_data: bool,
) -> Result<(), String> {
    state.manager(&app)?.remove(id, delete_data);
    Ok(())
}

/// Speed limit for all downloads together in bytes per second (0 = none).
#[tauri::command]
pub fn downloads_set_limit(
    app: AppHandle,
    state: State<'_, Downloads>,
    bps: u64,
) -> Result<(), String> {
    state.manager(&app)?.set_global_limit(bps);
    Ok(())
}

#[tauri::command]
pub fn downloads_set_job_limit(
    app: AppHandle,
    state: State<'_, Downloads>,
    id: u64,
    bps: u64,
) -> Result<(), String> {
    state.manager(&app)?.set_job_limit(id, bps);
    Ok(())
}

#[tauri::command]
pub fn downloads_global_limit(app: AppHandle, state: State<'_, Downloads>) -> Result<u64, String> {
    Ok(state.manager(&app)?.global_limit())
}

/// Compares a finished file with a pasted SHA-256/SHA-512 (result arrives with the list).
#[tauri::command]
pub fn downloads_verify(
    app: AppHandle,
    state: State<'_, Downloads>,
    id: u64,
    expected: String,
) -> Result<(), String> {
    state
        .manager(&app)?
        .verify(id, &expected)
        .map_err(add_error)
}

/// Shows the file (or, before it exists, its folder) in the file manager. Never opens the file.
#[tauri::command]
pub fn downloads_reveal(
    app: AppHandle,
    state: State<'_, Downloads>,
    id: u64,
) -> Result<(), String> {
    let job = state
        .manager(&app)?
        .snapshot()
        .into_iter()
        .find(|j| j.id == id)
        .ok_or("not-found")?;
    let target = if job.final_path().exists() {
        job.final_path()
    } else {
        job.dir.clone()
    };
    ::disk_scan::reveal_in_file_manager(&target).map_err(|_| "unsupported".to_string())
}
