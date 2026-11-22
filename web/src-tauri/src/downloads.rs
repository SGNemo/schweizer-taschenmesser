//! Downloads module (desktop only): thin wrapper around the `downloader` crate. The webview names a
//! folder (picked in the system dialog) and an address; files are only written there, never opened or
//! started. "Folder" shows the file in the file manager.

use std::{
    path::{Path, PathBuf},
    sync::{Arc, Mutex, OnceLock},
};

use ::downloader::{AddError, Job, Manager};
use tauri::{ipc::Channel, AppHandle, Manager as _, State};

#[derive(Default)]
pub struct Downloads {
    manager: OnceLock<Manager>,
    watchers: Arc<Mutex<Vec<Channel<Vec<Job>>>>>,
    /// One `downloads_*` command at a time: they run off the main thread, and the main thread used
    /// to be what kept two of them (two writes of the job list, pause and resume) apart.
    gate: Mutex<()>,
    /// Folders the user chose in the native dialog on this PC (DL6, DL10); read once from
    /// `download-folders.json`, which only Rust writes.
    picked: Mutex<Option<Vec<PathBuf>>>,
}

/// Most folders remembered (the newest stay).
const MAX_PICKED: usize = 20;

fn picked_file(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(state_file(app)?.with_file_name("download-folders.json"))
}

/// Same folder, same spelling: links and `..` resolved, so a string cannot dress up another path.
fn canonical(dir: &Path) -> Option<PathBuf> {
    std::fs::canonicalize(dir).ok().filter(|p| p.is_dir())
}

/// Whether `dir` may receive files (DL6): the system's Downloads folder, or a folder the user picked
/// in the native dialog on this PC. A folder from synced settings, a backup or a script in the web
/// view is refused (`dir`) until it is picked here. Returns the folder to use.
fn allowed(dir: &Path, downloads: Option<&Path>, picked: &[PathBuf]) -> Result<PathBuf, String> {
    let dir = canonical(dir).ok_or("dir")?;
    let is_downloads = downloads.and_then(canonical).is_some_and(|d| d == dir);
    if is_downloads || picked.contains(&dir) {
        Ok(PathBuf::from(display_path(&dir)))
    } else {
        Err("dir".into())
    }
}

/// A resolved path as people (and librqbit) write it: no `\\?\` prefix on Windows. The
/// comparison above uses the resolved form.
fn display_path(p: &Path) -> String {
    let s = p.to_string_lossy();
    if let Some(rest) = s.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{rest}")
    } else {
        s.strip_prefix(r"\\?\").unwrap_or(&s).to_string()
    }
}

impl Downloads {
    fn picked(&self, app: &AppHandle) -> Vec<PathBuf> {
        let mut slot = self.picked.lock().unwrap_or_else(|e| e.into_inner());
        if slot.is_none() {
            let list: Vec<PathBuf> = picked_file(app)
                .ok()
                .and_then(|f| std::fs::read(f).ok())
                .and_then(|b| serde_json::from_slice(&b).ok())
                .unwrap_or_default();
            *slot = Some(list);
        }
        slot.clone().unwrap_or_default()
    }

    /// Checks `dir` for a download or a torrent (`crate::torrent` asks too).
    pub(crate) fn target(&self, app: &AppHandle, dir: &str) -> Result<PathBuf, String> {
        let downloads = app.path().download_dir().ok();
        allowed(Path::new(dir), downloads.as_deref(), &self.picked(app))
    }
}

pub(crate) fn state_file(app: &AppHandle) -> Result<PathBuf, String> {
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
    /// Whether a download is running or waiting right now (remote control asks before it shuts
    /// the PC down). `false` while the module was never opened in this run.
    pub fn active(&self) -> bool {
        self.manager.get().is_some_and(|m| {
            m.snapshot().iter().any(|j| {
                matches!(
                    j.state,
                    ::downloader::State::Running | ::downloader::State::Queued
                )
            })
        })
    }

    /// Runs `f` with the manager while no other `downloads_*` command runs. The manager is created
    /// on first use (under the same gate, so only once), so an app that never opens the module
    /// does nothing.
    fn with<T>(&self, app: &AppHandle, f: impl FnOnce(&Manager) -> T) -> Result<T, String> {
        let _one_at_a_time = self.gate.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(m) = self.manager.get() {
            return Ok(f(m));
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
        Ok(f(self.manager.get_or_init(|| m)))
    }
}

/// "Alle Daten löschen": takes every job out of the list (the files already written stay where
/// the user put them) and removes `downloads.json`.
pub(crate) fn wipe(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<Downloads>();
    {
        let _one_at_a_time = state.gate.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(m) = state.manager.get() {
            for job in m.snapshot() {
                m.remove(job.id, false);
            }
        }
    }
    {
        // not between a pick's read and write
        let _one_at_a_time = state.gate.lock().unwrap_or_else(|e| e.into_inner());
        *state.picked.lock().unwrap_or_else(|e| e.into_inner()) = Some(Vec::new());
        crate::device_wipe::remove_file(&picked_file(app)?)?;
    }
    crate::device_wipe::remove_file(&state_file(app)?)
}

fn add_error(e: AddError) -> String {
    e.code().to_string()
}

/// Sends the current list now and after every change (about four times a second while downloading).
#[tauri::command(async)]
pub fn downloads_watch(
    app: AppHandle,
    state: State<'_, Downloads>,
    events: Channel<Vec<Job>>,
) -> Result<(), String> {
    state.with(&app, |manager| {
        let _ = events.send(manager.snapshot());
        state
            .watchers
            .lock()
            .map_err(|_| "internal".to_string())?
            .push(events);
        Ok(())
    })?
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
#[tauri::command(async)]
pub fn downloads_add(
    app: AppHandle,
    state: State<'_, Downloads>,
    url: String,
    dir: String,
    expected_hash: Option<String>,
) -> Result<Job, String> {
    let dir = state.target(&app, &dir)?;
    state
        .with(&app, |m| m.add(&url, &dir, expected_hash.as_deref()))?
        .map_err(add_error)
}

/// "Ordner wählen": Rust opens the system folder dialog itself and remembers the choice, so only a
/// folder the user picked here (or the Downloads folder) is ever written to (DL6). `None` when the
/// user cancels.
#[tauri::command(async)]
pub fn downloads_pick_dir(
    app: AppHandle,
    state: State<'_, Downloads>,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt as _;
    let Some(chosen) = app.dialog().file().blocking_pick_folder() else {
        return Ok(None);
    };
    let path = chosen.into_path().map_err(|_| "dir")?;
    let dir = canonical(&path).ok_or("dir")?;
    // read-modify-write of the list one at a time (two quick picks keep both)
    let _one_at_a_time = state.gate.lock().unwrap_or_else(|e| e.into_inner());
    let mut list = state.picked(&app);
    list.retain(|p| *p != dir);
    list.push(dir.clone());
    if list.len() > MAX_PICKED {
        list.remove(0);
    }
    let json = serde_json::to_vec(&list).map_err(|_| "internal")?;
    std::fs::write(picked_file(&app)?, json).map_err(|_| "io")?;
    *state.picked.lock().unwrap_or_else(|e| e.into_inner()) = Some(list);
    Ok(Some(display_path(&dir)))
}

#[tauri::command(async)]
pub fn downloads_pause(app: AppHandle, state: State<'_, Downloads>, id: u64) -> Result<(), String> {
    state.with(&app, |m| m.pause(id))
}

#[tauri::command(async)]
pub fn downloads_resume(
    app: AppHandle,
    state: State<'_, Downloads>,
    id: u64,
) -> Result<(), String> {
    state.with(&app, |m| m.resume(id))
}

#[tauri::command(async)]
pub fn downloads_remove(
    app: AppHandle,
    state: State<'_, Downloads>,
    id: u64,
    delete_data: bool,
) -> Result<(), String> {
    state.with(&app, |m| m.remove(id, delete_data))
}

/// Speed limit for all downloads together in bytes per second (0 = none).
#[tauri::command(async)]
pub fn downloads_set_limit(
    app: AppHandle,
    state: State<'_, Downloads>,
    bps: u64,
) -> Result<(), String> {
    state.with(&app, |m| m.set_global_limit(bps))
}

#[tauri::command(async)]
pub fn downloads_set_job_limit(
    app: AppHandle,
    state: State<'_, Downloads>,
    id: u64,
    bps: u64,
) -> Result<(), String> {
    state.with(&app, |m| m.set_job_limit(id, bps))
}

#[tauri::command(async)]
pub fn downloads_global_limit(app: AppHandle, state: State<'_, Downloads>) -> Result<u64, String> {
    state.with(&app, Manager::global_limit)
}

/// Compares a finished file with a pasted SHA-256/SHA-512 (result arrives with the list).
#[tauri::command(async)]
pub fn downloads_verify(
    app: AppHandle,
    state: State<'_, Downloads>,
    id: u64,
    expected: String,
) -> Result<(), String> {
    state
        .with(&app, |m| m.verify(id, &expected))?
        .map_err(add_error)
}

/// Shows the file (or, before it exists, its folder) in the file manager. Never opens the file.
#[tauri::command(async)]
pub fn downloads_reveal(
    app: AppHandle,
    state: State<'_, Downloads>,
    id: u64,
) -> Result<(), String> {
    let job = state
        .with(&app, Manager::snapshot)?
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

#[cfg(test)]
mod folder_tests {
    use super::*;

    #[test]
    fn folders_are_shown_without_the_verbatim_prefix() {
        assert_eq!(
            display_path(Path::new(r"\\?\C:\Users\x\Downloads")),
            r"C:\Users\x\Downloads"
        );
        assert_eq!(
            display_path(Path::new(r"\\?\UNC\nas\share")),
            r"\\nas\share"
        );
        assert_eq!(
            display_path(Path::new("/home/x/Downloads")),
            "/home/x/Downloads"
        );
    }

    /// DL6/DL10: a folder named by the web view (from synced settings, a backup, a script) is
    /// refused unless it is the Downloads folder or one picked in the native dialog here.
    #[test]
    fn only_the_downloads_folder_and_picked_folders_are_targets() {
        let root = std::env::temp_dir().join(format!("nemo-dl-allowed-{}", std::process::id()));
        let downloads = root.join("Downloads");
        let picked = root.join("Filme");
        let startup = root.join("Startup");
        for d in [&downloads, &picked, &startup] {
            std::fs::create_dir_all(d).unwrap();
        }
        let list = vec![canonical(&picked).unwrap()];
        assert!(allowed(&downloads, Some(&downloads), &list).is_ok());
        assert!(allowed(&picked, Some(&downloads), &list).is_ok());
        assert_eq!(
            allowed(&startup, Some(&downloads), &list),
            Err("dir".to_owned())
        );
        // another spelling of a refused folder stays refused; a picked one stays allowed
        let sneaky = picked.join("..").join("Startup");
        assert!(allowed(&sneaky, Some(&downloads), &list).is_err());
        let same = downloads.join("..").join("Filme");
        assert!(allowed(&same, Some(&downloads), &list).is_ok());
        assert!(allowed(&root.join("missing"), Some(&downloads), &list).is_err());
        let _ = std::fs::remove_dir_all(&root);
    }
}
