//! PC care of the disk module (desktop): the thin Tauri side around the `pc_tune` crate.
//!
//! Holds the journal (what the page changed on this PC, with the values to take it back) and
//! opens Windows' own tools from a fixed list. Nothing here runs by itself, nothing takes a path
//! or a program name from the webview, and no value is logged.

use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use ::pc_tune::tweaks::{self, ResetReport};
use ::pc_tune::{
    apply_undo, system_effects, system_registry, EntryView, Journal, RegError, Target, Tool,
    TweakState,
};
use serde::Serialize;
use tauri::{AppHandle, Manager, State};

/// The journal, opened on first use (`<app local data>/pc-care/journal.json`, device-local).
#[derive(Default)]
pub struct PcCare(Mutex<Option<Opened>>);

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
        let mut slot = self.0.lock().map_err(|_| "internal")?;
        if slot.is_none() {
            let (journal, recovered) = Journal::open(&journal_path(app)?);
            *slot = Some(Opened { journal, recovered });
        }
        f(&mut slot.as_mut().expect("just opened").journal)
    }

    fn recovered(&self) -> bool {
        self.0
            .lock()
            .ok()
            .and_then(|s| s.as_ref().map(|o| o.recovered))
            .unwrap_or(false)
    }
}

/// Notes a finished deletion in the history (category and size only, never a name or a path).
/// Best effort: the files are already gone, a history that cannot be written must not fail that.
pub fn note_cleanup(app: &AppHandle, category: &str, bytes: u64, files: u64, permanent: bool) {
    if let Some(care) = app.try_state::<PcCare>() {
        let _ = care.with(app, |j| {
            j.record_cleanup(unix_now(), category, bytes, files, permanent)
                .map_err(|e| e.code().to_string())
        });
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryView {
    entries: Vec<EntryView>,
    /// The history file was unreadable and a new one was started.
    recovered: bool,
}

/// What the page changed on this PC, newest first (without the stored values).
#[tauri::command(async)]
pub fn disk_care_history(app: AppHandle, care: State<'_, PcCare>) -> Result<HistoryView, String> {
    let entries = care.with(&app, |j| Ok(j.views()))?;
    Ok(HistoryView {
        entries,
        recovered: care.recovered(),
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
fn undo_other(what: &str, previous: &str) -> Result<(), RegError> {
    // Settings: a Windows on/off API or the active power plan (`pc_tune::tweaks`).
    let effects = system_effects().ok_or(RegError::Unsupported)?;
    tweaks::apply_other(effects.as_ref(), what, previous)
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

/// The catalogue of Windows settings with their state on this PC (on/off or the chosen plan;
/// never a registry value).
#[tauri::command(async)]
pub fn disk_tweaks_list(
    app: AppHandle,
    care: State<'_, PcCare>,
) -> Result<Vec<TweakState>, String> {
    let reg = system_registry().ok_or("unsupported")?;
    let effects = system_effects().ok_or("unsupported")?;
    care.with(&app, |j| {
        Ok(tweaks::state(j, reg.as_ref(), effects.as_ref()))
    })
}

/// Switches one setting of the catalogue (`target`: `true`/`false`, or the id of a choice). The
/// state from before goes into the journal first; unknown ids are refused.
#[tauri::command(async)]
pub fn disk_tweak_set(
    app: AppHandle,
    care: State<'_, PcCare>,
    id: String,
    target: Target,
) -> Result<(), String> {
    let reg = system_registry().ok_or("unsupported")?;
    let effects = system_effects().ok_or("unsupported")?;
    care.with(&app, |j| {
        tweaks::set(j, reg.as_ref(), effects.as_ref(), &id, &target, unix_now())
            .map(|_| ())
            .map_err(|e| e.code().to_string())
    })
}

/// "Alle zurücksetzen": every setting changed here goes back to the state from before its first
/// change. Reports which were put back and which could not be.
#[tauri::command(async)]
pub fn disk_tweaks_reset_all(
    app: AppHandle,
    care: State<'_, PcCare>,
) -> Result<ResetReport, String> {
    let reg = system_registry().ok_or("unsupported")?;
    let effects = system_effects().ok_or("unsupported")?;
    care.with(&app, |j| {
        Ok(tweaks::reset_all(j, reg.as_ref(), effects.as_ref()))
    })
}
