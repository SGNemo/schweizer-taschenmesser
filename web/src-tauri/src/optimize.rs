//! PC care of the disk module (desktop): the thin Tauri side around the `pc_tune` crate.
//!
//! Holds the journal (what the page changed on this PC: clean-ups for this session in memory,
//! changes with the values to take them back in a device-local file) and
//! opens Windows' own tools from a fixed list. Nothing here runs by itself, nothing takes a path
//! or a program name from the webview, and no value is logged.

use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use ::pc_tune::{apply_undo, cleanup_view, system_registry, EntryView, Journal, RegError, Tool};
use serde::Serialize;
use tauri::{AppHandle, Manager, State};

/// The journal, opened on first use (`<app local data>/pc-care/journal.json`, device-local).
#[derive(Default)]
pub struct PcCare {
    journal: Mutex<Option<Opened>>,
    /// Clean-ups of this session: memory only, never written (the disk module holds no data).
    session: Mutex<Vec<EntryView>>,
}

/// Session lines get ids from here up, far above any journal id, so the two never collide
/// (and well inside what the webview's numbers hold exactly).
const SESSION_ID_BASE: u64 = 1 << 40;
/// Most clean-up lines kept for the session.
const SESSION_MAX: usize = 300;

struct Opened {
    journal: Journal,
    /// The file was unreadable and set aside: older undo values are gone.
    recovered: bool,
}

pub fn unix_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn journal_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|d| d.join("pc-care").join("journal.json"))
        .map_err(|_| "internal".to_string())
}

impl PcCare {
    /// Runs `f` with the journal of this machine.
    pub fn with<T>(
        &self,
        app: &AppHandle,
        f: impl FnOnce(&mut Journal) -> Result<T, String>,
    ) -> Result<T, String> {
        let mut slot = self.journal.lock().map_err(|_| "internal")?;
        if slot.is_none() {
            // A journal that cannot be read is not cached: the next call tries again, and until
            // then nothing is changed or written.
            let (journal, recovered) =
                Journal::open(&journal_path(app)?).map_err(|e| e.code().to_string())?;
            *slot = Some(Opened { journal, recovered });
        }
        f(&mut slot.as_mut().expect("just opened").journal)
    }

    fn recovered(&self) -> bool {
        self.journal
            .lock()
            .ok()
            .and_then(|s| s.as_ref().map(|o| o.recovered))
            .unwrap_or(false)
    }
}

/// Notes a finished deletion in the history of this session (category and size only, never a
/// name or a path; kept in memory, not written to disk, independent of the journal file).
pub fn note_cleanup(app: &AppHandle, category: &str, bytes: u64, files: u64, permanent: bool) {
    let Some(care) = app.try_state::<PcCare>() else {
        return;
    };
    if let Ok(mut session) = care.session.lock() {
        let id = SESSION_ID_BASE + session.last().map_or(0, |e| e.id - SESSION_ID_BASE + 1);
        session.push(cleanup_view(
            id,
            unix_now(),
            category,
            bytes,
            files,
            permanent,
        ));
        let extra = session.len().saturating_sub(SESSION_MAX);
        session.drain(..extra);
    };
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryView {
    entries: Vec<EntryView>,
    /// The history file was unreadable and a new one was started.
    recovered: bool,
    /// The file with the stored changes cannot be read right now: only this session's
    /// clean-ups are listed, and nothing can be changed or taken back until it can.
    unreadable: bool,
}

/// What the page changed on this PC, newest first (without the stored values): this session's
/// clean-ups and the stored changes.
#[tauri::command(async)]
pub fn disk_care_history(app: AppHandle, care: State<'_, PcCare>) -> Result<HistoryView, String> {
    let stored = care.with(&app, |j| Ok(j.views()));
    let unreadable = stored.is_err();
    let mut entries = stored.unwrap_or_default();
    entries.extend(care.session.lock().map_err(|_| "internal")?.iter().cloned());
    entries.sort_by(|a, b| b.at.cmp(&a.at).then(b.id.cmp(&a.id)));
    Ok(HistoryView {
        entries,
        recovered: care.recovered(),
        unreadable,
    })
}

/// Opens one of Windows' own tools (fixed list in `pc_tune::Tool`; unknown names are refused).
#[tauri::command(async)]
pub fn disk_care_open_tool(tool: String) -> Result<(), String> {
    let tool = Tool::from_code(&tool).ok_or("unknown-tool")?;
    tool.open().map_err(|_| "unsupported".to_string())
}

/// Takes back the parts of an undo that are not registry values. Each package that makes such a
/// change adds its case here; an unknown one is refused, so nothing is marked as taken back that
/// was not.
fn undo_other(_what: &str, _previous: &str) -> Result<(), RegError> {
    Err(RegError::Unsupported)
}

/// Takes one change of the history back (the newest change of its subject only) by putting the
/// stored values from before in place again. A clean-up has nothing to take back here: its way
/// back is the recycle bin.
#[tauri::command(async)]
pub fn disk_care_undo(app: AppHandle, care: State<'_, PcCare>, id: u64) -> Result<(), String> {
    let reg = system_registry().ok_or("unsupported")?;
    care.with(&app, |j| {
        let steps = j.undo_steps(id).map_err(|e| e.code().to_string())?;
        apply_undo(reg.as_ref(), &steps, undo_other).map_err(|e| e.code().to_string())?;
        j.mark_undone(id).map_err(|e| e.code().to_string())
    })
}
