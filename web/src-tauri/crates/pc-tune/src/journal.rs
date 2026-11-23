//! The history of what the page changed on this PC, with the values needed to take it back.
//!
//! Clean-ups are not in here at all: the shell keeps them in memory for the session (the disk
//! module holds no data: `docs/RULES.md`; [`cleanup_view`] only shapes such a line). Changes
//! that need a way back (a setting, an autostart entry) are written to one small JSON file in the app's local data folder: device-local, never synced,
//! never part of a backup or a bug report. What an entry holds: the id of the setting or
//! autostart entry, a display name, the time, and per changed value its registry key, its value
//! name (for an autostart entry that is the Run value's name or the shortcut's file name) and
//! the bytes from before and after. Never a command line, a path or anything from a scan.
//!
//! Two stores in the file:
//! - `entries`: the changes, newest last, capped at [`MAX_ENTRIES`] (taken-back ones fall out
//!   first, then the oldest).
//! - `originals`: per subject (a setting, an autostart entry) the values from **before the first
//!   change**. They never fall out, so "Alle zurücksetzen" works however long the history is.

use crate::reg::{RegError, Registry, Value};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

pub const MAX_ENTRIES: usize = 300;
const VERSION: u32 = 1;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Kind {
    /// Files were moved to the recycle bin or deleted (clean-up tab or scan).
    Cleanup,
    /// An autostart entry was switched on or off.
    Startup,
    /// A Windows setting from the catalogue was changed.
    Tweak,
}

/// How to take one step back.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Undo {
    /// A value of the current user: `previous` is put back, `None` removes the value again.
    Reg {
        key: String,
        name: String,
        previous: Option<Value>,
        /// What the change wrote. When set, the undo is refused if the value is no longer this
        /// one: somebody (Windows' own settings, Task Manager) changed it since, and their
        /// choice must not be overwritten by ours from before.
        #[serde(default)]
        written: Option<Value>,
    },
    /// Something that is not a registry value (the active power plan, a system parameter):
    /// `what` names it, `previous` is its old state as text. Applied by the module that owns it.
    Other {
        what: String,
        previous: String,
        /// What the change set it to. When given, the owner refuses the undo if the state is
        /// no longer this one (changed elsewhere since).
        #[serde(default)]
        written: Option<String>,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub id: u64,
    /// Unix seconds.
    pub at: i64,
    pub kind: Kind,
    /// Clean-up: the category code (`temp`, …, or `scan`). Setting: its id. Autostart: the
    /// entry's id.
    pub subject: String,
    /// Display name where the id says nothing (an autostart program's name); else empty.
    #[serde(default)]
    pub label: String,
    /// Clean-up: bytes freed and files removed.
    #[serde(default)]
    pub bytes: u64,
    #[serde(default)]
    pub files: u64,
    /// Clean-up: deleted for good instead of moved to the recycle bin.
    #[serde(default)]
    pub permanent: bool,
    /// Setting / autostart: the state it was switched to.
    #[serde(default)]
    pub on: Option<bool>,
    #[serde(default)]
    pub undo: Vec<Undo>,
    #[serde(default)]
    pub undone: bool,
    /// The value was changed elsewhere (Windows' own settings) after this change: there is
    /// nothing left for this entry to take back.
    #[serde(default)]
    pub stale: bool,
}

/// What the webview gets: the entry without the stored values.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryView {
    pub id: u64,
    pub at: i64,
    pub kind: Kind,
    pub subject: String,
    pub label: String,
    pub bytes: u64,
    pub files: u64,
    pub permanent: bool,
    pub on: Option<bool>,
    pub can_undo: bool,
    pub undone: bool,
    /// Changed elsewhere since: cannot be taken back here any more.
    pub stale: bool,
}

#[derive(Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct File {
    version: u32,
    next_id: u64,
    entries: Vec<Entry>,
    #[serde(default)]
    originals: BTreeMap<String, Original>,
}

/// The values of a subject from before its first change, with the entry that made that change.
#[derive(Clone, Serialize, Deserialize)]
struct Original {
    entry: u64,
    undo: Vec<Undo>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum JournalError {
    /// The file could not be written: the change must not be made.
    NotSaved,
    /// The file exists but could not be read (locked, access denied): nothing is changed and
    /// nothing is written, so the stored undo values stay as they are.
    Unreadable,
    UnknownEntry,
    AlreadyUndone,
    /// The entry has nothing to take back (a clean-up: the recycle bin is the way back).
    NothingToUndo,
    /// A newer, not yet undone change of the same subject exists: undo that one first.
    NewerChange,
    /// The value was changed elsewhere since: this entry can no longer be taken back.
    ChangedElsewhere,
    Reg(RegError),
}

impl JournalError {
    pub fn code(&self) -> &'static str {
        match self {
            JournalError::NotSaved => "not-saved",
            JournalError::Unreadable => "journal-unreadable",
            JournalError::UnknownEntry => "unknown-entry",
            JournalError::AlreadyUndone => "already-undone",
            JournalError::NothingToUndo => "nothing-to-undo",
            JournalError::NewerChange => "newer-change",
            JournalError::ChangedElsewhere => "changed-elsewhere",
            JournalError::Reg(e) => e.code(),
        }
    }
}

/// The journal of one machine. Every method that changes it saves before it returns.
pub struct Journal {
    path: PathBuf,
    file: File,
}

/// A clean-up as a history line (kept by the caller for the session, never stored here): a
/// category with a size, nothing to undo — the recycle bin is the way back.
pub fn cleanup_view(
    id: u64,
    at: i64,
    category: &str,
    bytes: u64,
    files: u64,
    permanent: bool,
) -> EntryView {
    EntryView {
        id,
        at,
        kind: Kind::Cleanup,
        subject: category.to_string(),
        label: String::new(),
        bytes,
        files,
        permanent,
        on: None,
        can_undo: false,
        undone: false,
        stale: false,
    }
}

fn subject_key(kind: Kind, subject: &str) -> String {
    let k = match kind {
        Kind::Cleanup => "cleanup",
        Kind::Startup => "startup",
        Kind::Tweak => "tweak",
    };
    format!("{k}:{subject}")
}

impl Journal {
    /// Opens the journal at `path`. A missing file is an empty journal. A file that exists but
    /// cannot be read, or that a newer version of the app wrote, is an error (it is not touched).
    /// One that is read but makes no sense is set aside as `<name>.bad` (never over an earlier
    /// one) and an empty journal starts: the stored undo values are then gone, which the
    /// returned flag tells the caller.
    pub fn open(path: &Path) -> Result<(Journal, bool), JournalError> {
        let mut recovered = false;
        let file = match std::fs::read(path) {
            Ok(bytes) => match serde_json::from_slice::<File>(&bytes) {
                Ok(f) if f.version == VERSION => f,
                Ok(f) if f.version > VERSION => return Err(JournalError::Unreadable),
                _ => {
                    recovered = true;
                    let mut bad = path.as_os_str().to_owned();
                    bad.push(".bad");
                    let bad = PathBuf::from(bad);
                    if bad.exists() {
                        return Err(JournalError::Unreadable);
                    }
                    std::fs::rename(path, bad).map_err(|_| JournalError::Unreadable)?;
                    File::default()
                }
            },
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => File::default(),
            Err(_) => return Err(JournalError::Unreadable),
        };
        let mut j = Journal {
            path: path.to_path_buf(),
            file,
        };
        j.file.version = VERSION;
        Ok((j, recovered))
    }

    /// Writes the file next to itself and renames it over the old one, so a crash never leaves
    /// half a journal.
    fn save(&self) -> Result<(), JournalError> {
        let bytes = serde_json::to_vec(&self.file).map_err(|_| JournalError::NotSaved)?;
        if let Some(dir) = self.path.parent() {
            std::fs::create_dir_all(dir).map_err(|_| JournalError::NotSaved)?;
        }
        let mut tmp = self.path.as_os_str().to_owned();
        tmp.push(".tmp");
        let tmp = PathBuf::from(tmp);
        // Flushed to the disk before the rename, so a power loss cannot leave an empty file
        // under the journal's name.
        let written = std::fs::File::create(&tmp).and_then(|mut f| {
            use std::io::Write;
            f.write_all(&bytes)?;
            f.sync_all()
        });
        if written.is_err() {
            let _ = std::fs::remove_file(&tmp);
            return Err(JournalError::NotSaved);
        }
        std::fs::rename(&tmp, &self.path).map_err(|_| {
            let _ = std::fs::remove_file(&tmp);
            JournalError::NotSaved
        })
    }

    /// Keeps the stored history at [`MAX_ENTRIES`]: taken-back entries go first, then the oldest.
    fn trim(&mut self) {
        while self.file.entries.len() > MAX_ENTRIES {
            let i = self.file.entries.iter().position(|e| e.undone).unwrap_or(0);
            self.file.entries.remove(i);
        }
    }

    /// Makes a change **after** its undo values are safely on disk: the entry is saved first,
    /// then `apply` runs; when `apply` fails the entry is taken out again. So there is never a
    /// change without a way back, whatever happens in between. `apply` must be all-or-nothing
    /// (one write, or [`crate::reg::set_all`] for several): when it fails, nothing may be left
    /// changed.
    #[allow(clippy::too_many_arguments)]
    pub fn change<E>(
        &mut self,
        at: i64,
        kind: Kind,
        subject: &str,
        label: &str,
        on: Option<bool>,
        undo: Vec<Undo>,
        apply: impl FnOnce() -> Result<(), E>,
    ) -> Result<u64, ChangeError<E>> {
        let key = subject_key(kind, subject);
        self.file.next_id += 1;
        let id = self.file.next_id;
        let first = !self.file.originals.contains_key(&key);
        if first {
            self.file.originals.insert(
                key.clone(),
                Original {
                    entry: id,
                    undo: undo.clone(),
                },
            );
        }
        self.file.entries.push(Entry {
            id,
            at,
            kind,
            subject: subject.to_string(),
            label: label.to_string(),
            bytes: 0,
            files: 0,
            permanent: false,
            on,
            undo,
            undone: false,
            stale: false,
        });
        let take_out = |j: &mut Journal| {
            j.file.entries.retain(|x| x.id != id);
            if first {
                j.file.originals.remove(&key);
            }
        };
        if let Err(e) = self.save() {
            take_out(self);
            return Err(ChangeError::Journal(e));
        }
        if let Err(e) = apply() {
            take_out(self);
            let _ = self.save();
            return Err(ChangeError::Apply(e));
        }
        // Only now, with the change made, may an older entry fall out of the history.
        if self.file.entries.len() > MAX_ENTRIES {
            self.trim();
            let _ = self.save();
        }
        Ok(id)
    }

    /// The steps that take entry `id` back (newest change of its subject only), without applying
    /// them. The caller applies them and then calls [`Journal::mark_undone`].
    pub fn undo_steps(&self, id: u64) -> Result<Vec<Undo>, JournalError> {
        let e = self
            .file
            .entries
            .iter()
            .find(|e| e.id == id)
            .ok_or(JournalError::UnknownEntry)?;
        if e.undone {
            return Err(JournalError::AlreadyUndone);
        }
        if e.stale {
            return Err(JournalError::ChangedElsewhere);
        }
        if e.undo.is_empty() {
            return Err(JournalError::NothingToUndo);
        }
        // A newer open change of the same subject, or of another subject that wrote one of the
        // same values: taking this one back first would put a stale value over the newer one.
        let touches = |x: &Entry| {
            x.undo.iter().any(|theirs| {
                e.undo.iter().any(|mine| match (mine, theirs) {
                    (
                        Undo::Reg { key, name, .. },
                        Undo::Reg {
                            key: k, name: n, ..
                        },
                    ) => key.eq_ignore_ascii_case(k) && name.eq_ignore_ascii_case(n),
                    (Undo::Other { what, .. }, Undo::Other { what: w, .. }) => what == w,
                    _ => false,
                })
            })
        };
        let newer = self.file.entries.iter().any(|x| {
            x.id > id && !x.undone && ((x.kind == e.kind && x.subject == e.subject) || touches(x))
        });
        if newer {
            return Err(JournalError::NewerChange);
        }
        Ok(e.undo.clone())
    }

    /// Marks an entry as taken back. When it is the entry that made the subject's first change,
    /// the subject is back where it started and the original is forgotten.
    pub fn mark_undone(&mut self, id: u64) -> Result<(), JournalError> {
        let e = self
            .file
            .entries
            .iter_mut()
            .find(|e| e.id == id)
            .ok_or(JournalError::UnknownEntry)?;
        e.undone = true;
        let key = subject_key(e.kind, &e.subject);
        if self.file.originals.get(&key).is_some_and(|o| o.entry == id) {
            self.file.originals.remove(&key);
        }
        self.save()
    }

    /// After an undo or reset found the subject's value changed elsewhere: its open entries are
    /// marked as no longer undoable and its original is forgotten. What stands now is the
    /// user's newer choice, made outside the app, and nothing here will touch it again.
    pub fn mark_stale(&mut self, kind: Kind, subject: &str) -> Result<(), JournalError> {
        for e in &mut self.file.entries {
            if e.kind == kind && e.subject == subject && !e.undone && !e.undo.is_empty() {
                e.stale = true;
            }
        }
        self.file.originals.remove(&subject_key(kind, subject));
        self.save()
    }

    /// Kind and subject of an entry (to mark its subject after a refused undo).
    pub fn subject_of(&self, id: u64) -> Option<(Kind, String)> {
        self.file
            .entries
            .iter()
            .find(|e| e.id == id)
            .map(|e| (e.kind, e.subject.clone()))
    }

    /// Subjects of `kind` that are changed right now, with the values from before their first
    /// change ("Alle zurücksetzen"). Each step expects the value the subject's newest open change
    /// wrote, so a reset, like an undo, leaves alone what was changed elsewhere since.
    pub fn originals(&self, kind: Kind) -> Vec<(String, Vec<Undo>)> {
        let prefix = subject_key(kind, "");
        self.file
            .originals
            .iter()
            .filter_map(|(k, v)| {
                let subject = k.strip_prefix(&prefix)?;
                let steps = v
                    .undo
                    .iter()
                    .map(|step| self.with_newest_written(kind, subject, step))
                    .collect();
                Some((subject.to_string(), steps))
            })
            .collect()
    }

    /// `step` with `written` taken from the newest open change of the subject to the same value.
    /// When the history no longer holds one (trimmed after very many changes), the step comes
    /// without it and is put back unchecked: refusing would leave the subject stuck for good.
    fn with_newest_written(&self, kind: Kind, subject: &str, step: &Undo) -> Undo {
        let open = || {
            self.file
                .entries
                .iter()
                .rev()
                .filter(move |e| !e.undone && !e.stale && e.kind == kind && e.subject == subject)
                .flat_map(|e| &e.undo)
        };
        match step {
            Undo::Reg {
                key,
                name,
                previous,
                ..
            } => Undo::Reg {
                key: key.clone(),
                name: name.clone(),
                previous: previous.clone(),
                written: open()
                    .find_map(|u| match u {
                        Undo::Reg {
                            key: k,
                            name: n,
                            written,
                            ..
                        } if k.eq_ignore_ascii_case(key) && n.eq_ignore_ascii_case(name) => {
                            Some(written.clone())
                        }
                        _ => None,
                    })
                    .flatten(),
            },
            Undo::Other { what, previous, .. } => Undo::Other {
                what: what.clone(),
                previous: previous.clone(),
                written: open()
                    .find_map(|u| match u {
                        Undo::Other {
                            what: w, written, ..
                        } if w == what => Some(written.clone()),
                        _ => None,
                    })
                    .flatten(),
            },
        }
    }

    /// After a subject was put back to its original: its open entries count as undone.
    pub fn mark_reset(&mut self, kind: Kind, subject: &str) -> Result<(), JournalError> {
        for e in &mut self.file.entries {
            if e.kind == kind && e.subject == subject && !e.undo.is_empty() && !e.stale {
                e.undone = true;
            }
        }
        self.file.originals.remove(&subject_key(kind, subject));
        self.save()
    }

    /// Newest first, without the stored values.
    pub fn views(&self) -> Vec<EntryView> {
        self.file
            .entries
            .iter()
            .rev()
            .map(|e| EntryView {
                id: e.id,
                at: e.at,
                kind: e.kind,
                subject: e.subject.clone(),
                label: e.label.clone(),
                bytes: e.bytes,
                files: e.files,
                permanent: e.permanent,
                on: e.on,
                can_undo: !e.undone && self.undo_steps(e.id).is_ok(),
                undone: e.undone,
                stale: e.stale,
            })
            .collect()
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum ChangeError<E> {
    /// The undo values could not be saved, so nothing was changed.
    Journal(JournalError),
    /// The change itself failed; the entry was taken out again.
    Apply(E),
}

/// Applies the steps of an undo. Before anything is put back, every registry step that knows
/// what it wrote is checked: when the value is no longer that one, the whole undo is refused
/// with [`RegError::ChangedElsewhere`] and nothing is touched. `Other` steps are for the caller
/// (`on_other(what, previous, written)`), which makes the same check for its own kind of state.
pub fn apply_undo(
    reg: &dyn Registry,
    steps: &[Undo],
    mut on_other: impl FnMut(&str, &str, Option<&str>) -> Result<(), RegError>,
) -> Result<(), RegError> {
    for step in steps {
        if let Undo::Reg {
            key,
            name,
            previous,
            written,
        } = step
        {
            // PC2: only a value of the shape that belongs there is ever put back
            if previous
                .as_ref()
                .is_some_and(|p| !crate::reg::restorable(key, name, p))
            {
                return Err(RegError::KeyNotAllowed);
            }
            if let Some(written) = written {
                if reg.get(key, name)?.as_ref() != Some(written) {
                    return Err(RegError::ChangedElsewhere);
                }
            }
        }
    }
    for step in steps {
        match step {
            Undo::Reg {
                key,
                name,
                previous,
                ..
            } => reg.restore(key, name, previous.as_ref())?,
            Undo::Other {
                what,
                previous,
                written,
            } => on_other(what, previous, written.as_deref())?,
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::reg::MemRegistry;
    use std::sync::atomic::{AtomicU64, Ordering};

    const KEY: &str = r"Software\Test";

    fn temp_path(tag: &str) -> PathBuf {
        static N: AtomicU64 = AtomicU64::new(0);
        std::env::temp_dir()
            .join(format!(
                "tm-pc-tune-{tag}-{}-{}",
                std::process::id(),
                N.fetch_add(1, Ordering::Relaxed)
            ))
            .join("journal.json")
    }

    fn cleanup(path: &Path) {
        if let Some(dir) = path.parent() {
            let _ = std::fs::remove_dir_all(dir);
        }
    }

    // PC2 (launch review 2026-11): a hand-edited journal decided which bytes an undo writes. An undo
    // now only puts back a value of the shape Windows itself keeps at that place; anything else is
    // refused before a single value is touched.
    #[test]
    fn an_undo_never_writes_a_value_that_does_not_belong_there() {
        let reg = MemRegistry::new();
        let startup = r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";
        let adv = r"Software\Microsoft\Windows\CurrentVersion\AdvertisingInfo";
        let forged = [
            (startup, "App", Value::binary(&[0x41; 4096])),
            (startup, "App", Value::Sz("cmd /c evil".into())),
            (adv, "Enabled", Value::Sz("x".repeat(200))),
            (adv, "Enabled", Value::binary(&[0; 65])),
        ];
        for (key, name, previous) in forged {
            let steps = [Undo::Reg {
                key: key.into(),
                name: name.into(),
                previous: Some(previous.clone()),
                written: None,
            }];
            assert_eq!(
                apply_undo(&reg, &steps, |_, _, _| Ok(())),
                Err(RegError::KeyNotAllowed),
                "{previous:?}"
            );
            assert_eq!(reg.get(key, name), Ok(None), "nothing written");
        }
        // the shapes Windows keeps there are put back
        let ok = [
            Undo::Reg {
                key: startup.into(),
                name: "App".into(),
                previous: Some(Value::binary(&[2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                written: None,
            },
            Undo::Reg {
                key: adv.into(),
                name: "Enabled".into(),
                previous: Some(Value::Dword(1)),
                written: None,
            },
        ];
        assert_eq!(apply_undo(&reg, &ok, |_, _, _| Ok(())), Ok(()));
    }

    /// Switches `name` to `to` the way a real change does: read the old value, journal, write.
    fn switch(
        j: &mut Journal,
        reg: &MemRegistry,
        name: &str,
        to: u32,
    ) -> Result<u64, ChangeError<RegError>> {
        let undo = vec![Undo::Reg {
            key: KEY.into(),
            name: name.into(),
            previous: reg.get(KEY, name).unwrap(),
            written: Some(Value::Dword(to)),
        }];
        j.change(10, Kind::Tweak, name, "", Some(to == 1), undo, || {
            reg.set(KEY, name, &Value::Dword(to))
        })
    }

    #[test]
    fn a_change_can_be_taken_back_and_survives_a_restart() {
        let path = temp_path("undo");
        let reg = MemRegistry::new();
        reg.set(KEY, "a", &Value::Dword(1)).unwrap();
        let (mut j, recovered) = Journal::open(&path).unwrap();
        assert!(!recovered);
        let id = switch(&mut j, &reg, "a", 0).unwrap();
        assert_eq!(reg.get(KEY, "a"), Ok(Some(Value::Dword(0))));

        // A new process: the value from before is still there.
        let (mut j, _) = Journal::open(&path).unwrap();
        let steps = j.undo_steps(id).unwrap();
        apply_undo(&reg, &steps, |_, _, _| Ok(())).unwrap();
        j.mark_undone(id).unwrap();
        assert_eq!(reg.get(KEY, "a"), Ok(Some(Value::Dword(1))));
        assert_eq!(j.undo_steps(id), Err(JournalError::AlreadyUndone));
        assert!(j.originals(Kind::Tweak).is_empty());
        cleanup(&path);
    }

    #[test]
    fn undoing_a_value_that_did_not_exist_removes_it_again() {
        let path = temp_path("absent");
        let reg = MemRegistry::new();
        let (mut j, _) = Journal::open(&path).unwrap();
        let id = switch(&mut j, &reg, "new", 1).unwrap();
        apply_undo(&reg, &j.undo_steps(id).unwrap(), |_, _, _| Ok(())).unwrap();
        assert_eq!(reg.get(KEY, "new"), Ok(None));
        cleanup(&path);
    }

    #[test]
    fn a_failed_change_leaves_no_entry_and_no_original() {
        let path = temp_path("failed");
        let reg = MemRegistry::new();
        reg.fail_writes.store(true, Ordering::Relaxed);
        let (mut j, _) = Journal::open(&path).unwrap();
        assert_eq!(
            switch(&mut j, &reg, "a", 1),
            Err(ChangeError::Apply(RegError::Failed))
        );
        assert!(j.views().is_empty());
        assert!(j.originals(Kind::Tweak).is_empty());
        let (j, _) = Journal::open(&path).unwrap();
        assert!(j.views().is_empty());
        cleanup(&path);
    }

    #[test]
    fn nothing_is_changed_when_the_journal_cannot_be_saved() {
        // After opening, the journal's "folder" turns out to be a file, so saving must fail.
        let dir = temp_path("unsaved");
        let blocker = dir.parent().unwrap().to_path_buf();
        let reg = MemRegistry::new();
        let (mut j, _) = Journal::open(&dir).unwrap();
        std::fs::create_dir_all(blocker.parent().unwrap()).unwrap();
        std::fs::write(&blocker, b"x").unwrap();
        assert_eq!(
            switch(&mut j, &reg, "a", 1),
            Err(ChangeError::Journal(JournalError::NotSaved))
        );
        assert_eq!(reg.user_len(), 0, "the change must not have been made");
        let _ = std::fs::remove_file(&blocker);
    }

    #[test]
    fn only_the_newest_change_of_a_subject_can_be_undone() {
        let path = temp_path("order");
        let reg = MemRegistry::new();
        reg.set(KEY, "a", &Value::Dword(5)).unwrap();
        let (mut j, _) = Journal::open(&path).unwrap();
        let first = switch(&mut j, &reg, "a", 0).unwrap();
        let second = switch(&mut j, &reg, "a", 1).unwrap();
        let other = switch(&mut j, &reg, "b", 1).unwrap();
        assert_eq!(j.undo_steps(first), Err(JournalError::NewerChange));
        assert!(
            j.undo_steps(other).is_ok(),
            "another subject is independent"
        );
        let views = j.views();
        assert_eq!(views[0].id, other, "newest first");
        assert!(!views.iter().find(|v| v.id == first).unwrap().can_undo);
        assert!(views.iter().find(|v| v.id == second).unwrap().can_undo);

        apply_undo(&reg, &j.undo_steps(second).unwrap(), |_, _, _| Ok(())).unwrap();
        j.mark_undone(second).unwrap();
        assert_eq!(reg.get(KEY, "a"), Ok(Some(Value::Dword(0))));
        apply_undo(&reg, &j.undo_steps(first).unwrap(), |_, _, _| Ok(())).unwrap();
        j.mark_undone(first).unwrap();
        assert_eq!(reg.get(KEY, "a"), Ok(Some(Value::Dword(5))));
        cleanup(&path);
    }

    /// Fills the stored history with changes of other subjects until the oldest entries fall out.
    fn fill(j: &mut Journal, reg: &MemRegistry) {
        for i in 0..=MAX_ENTRIES {
            switch(j, reg, &format!("filler{i}"), 1).unwrap();
        }
    }

    #[test]
    fn reset_all_goes_back_to_the_value_before_the_first_change_even_when_the_history_is_full() {
        let path = temp_path("reset");
        let reg = MemRegistry::new();
        reg.set(KEY, "a", &Value::Dword(7)).unwrap();
        let (mut j, _) = Journal::open(&path).unwrap();
        let first = switch(&mut j, &reg, "a", 0).unwrap();
        switch(&mut j, &reg, "a", 1).unwrap();
        fill(&mut j, &reg);
        assert_eq!(j.views().len(), MAX_ENTRIES);
        assert!(j.views().iter().all(|v| v.id != first), "fell out");

        let (mut j, _) = Journal::open(&path).unwrap();
        for (subject, steps) in j.originals(Kind::Tweak) {
            apply_undo(&reg, &steps, |_, _, _| Ok(())).unwrap();
            j.mark_reset(Kind::Tweak, &subject).unwrap();
        }
        assert_eq!(reg.get(KEY, "a"), Ok(Some(Value::Dword(7))));
        assert_eq!(reg.get(KEY, "filler0"), Ok(None));
        assert!(j.originals(Kind::Tweak).is_empty());
        assert!(j.views().iter().all(|v| !v.can_undo));
        cleanup(&path);
    }

    #[test]
    fn the_original_stays_when_only_a_later_change_is_undone() {
        let path = temp_path("later");
        let reg = MemRegistry::new();
        reg.set(KEY, "a", &Value::Dword(7)).unwrap();
        let (mut j, _) = Journal::open(&path).unwrap();
        switch(&mut j, &reg, "a", 0).unwrap();
        fill(&mut j, &reg);
        let second = switch(&mut j, &reg, "a", 1).unwrap();
        apply_undo(&reg, &j.undo_steps(second).unwrap(), |_, _, _| Ok(())).unwrap();
        j.mark_undone(second).unwrap();
        assert_eq!(reg.get(KEY, "a"), Ok(Some(Value::Dword(0))));
        // "Alle zurücksetzen" still knows the 7 from before the first change.
        let original = j
            .originals(Kind::Tweak)
            .into_iter()
            .find(|(subject, _)| subject == "a")
            .expect("original kept");
        apply_undo(&reg, &original.1, |_, _, _| Ok(())).unwrap();
        assert_eq!(reg.get(KEY, "a"), Ok(Some(Value::Dword(7))));
        cleanup(&path);
    }

    #[test]
    fn the_original_is_tied_to_the_first_change_not_to_equal_values() {
        // off, on, off again: the third change stores the same "previous" as the original.
        let path = temp_path("tied");
        let reg = MemRegistry::new();
        reg.set(KEY, "a", &Value::Dword(1)).unwrap();
        let (mut j, _) = Journal::open(&path).unwrap();
        let a = switch(&mut j, &reg, "a", 0).unwrap();
        let b = switch(&mut j, &reg, "a", 1).unwrap();
        let c = switch(&mut j, &reg, "a", 0).unwrap();
        for id in [c, b] {
            apply_undo(&reg, &j.undo_steps(id).unwrap(), |_, _, _| Ok(())).unwrap();
            j.mark_undone(id).unwrap();
            assert_eq!(
                j.originals(Kind::Tweak).len(),
                1,
                "still changed by entry {a}"
            );
        }
        apply_undo(&reg, &j.undo_steps(a).unwrap(), |_, _, _| Ok(())).unwrap();
        j.mark_undone(a).unwrap();
        assert!(j.originals(Kind::Tweak).is_empty());
        assert_eq!(reg.get(KEY, "a"), Ok(Some(Value::Dword(1))));
        cleanup(&path);
    }

    #[test]
    fn taken_back_entries_fall_out_of_a_full_history_first() {
        let path = temp_path("trim");
        let reg = MemRegistry::new();
        let (mut j, _) = Journal::open(&path).unwrap();
        let oldest = switch(&mut j, &reg, "keep", 1).unwrap();
        let undone = switch(&mut j, &reg, "gone", 1).unwrap();
        apply_undo(&reg, &j.undo_steps(undone).unwrap(), |_, _, _| Ok(())).unwrap();
        j.mark_undone(undone).unwrap();
        for i in 0..MAX_ENTRIES - 1 {
            switch(&mut j, &reg, &format!("filler{i}"), 1).unwrap();
        }
        let views = j.views();
        assert_eq!(views.len(), MAX_ENTRIES);
        assert!(views.iter().any(|v| v.id == oldest && v.can_undo));
        assert!(views.iter().all(|v| v.id != undone));
        cleanup(&path);
    }

    #[test]
    fn a_clean_up_line_has_nothing_to_undo() {
        let v = cleanup_view(9, 5, "browserCache", 4096, 12, false);
        assert_eq!(
            (v.kind, v.bytes, v.files, v.permanent, v.can_undo, v.undone),
            (Kind::Cleanup, 4096, 12, false, false, false)
        );
    }

    #[test]
    fn a_change_of_another_subject_to_the_same_value_must_be_undone_first() {
        let path = temp_path("shared");
        let reg = MemRegistry::new();
        let (mut j, _) = Journal::open(&path).unwrap();
        let step = |reg: &MemRegistry| {
            vec![Undo::Reg {
                key: KEY.into(),
                name: "Shared".into(),
                previous: reg.get(KEY, "shared").unwrap(),
                written: None,
            }]
        };
        let first = j
            .change(1, Kind::Tweak, "one", "", Some(true), step(&reg), || {
                reg.set(KEY, "Shared", &Value::Dword(1))
            })
            .unwrap();
        let second = j
            .change(2, Kind::Startup, "two", "", Some(true), step(&reg), || {
                reg.set(KEY, "shared", &Value::Dword(2))
            })
            .unwrap();
        assert_eq!(j.undo_steps(first), Err(JournalError::NewerChange));
        apply_undo(&reg, &j.undo_steps(second).unwrap(), |_, _, _| Ok(())).unwrap();
        j.mark_undone(second).unwrap();
        apply_undo(&reg, &j.undo_steps(first).unwrap(), |_, _, _| Ok(())).unwrap();
        assert_eq!(reg.get(KEY, "Shared"), Ok(None));
        cleanup(&path);
    }

    #[test]
    fn an_undo_is_refused_when_the_value_was_changed_elsewhere_since() {
        let path = temp_path("elsewhere");
        let reg = MemRegistry::new();
        reg.set(KEY, "a", &Value::Dword(1)).unwrap();
        let (mut j, _) = Journal::open(&path).unwrap();
        let id = switch(&mut j, &reg, "a", 0).unwrap();
        // Windows' own settings change it afterwards.
        reg.set(KEY, "a", &Value::Dword(9)).unwrap();
        assert_eq!(
            apply_undo(&reg, &j.undo_steps(id).unwrap(), |_, _, _| Ok(())),
            Err(RegError::ChangedElsewhere)
        );
        assert_eq!(reg.get(KEY, "a"), Ok(Some(Value::Dword(9))), "left alone");
        // Removed elsewhere counts as changed, too.
        reg.delete(KEY, "a").unwrap();
        assert_eq!(
            apply_undo(&reg, &j.undo_steps(id).unwrap(), |_, _, _| Ok(())),
            Err(RegError::ChangedElsewhere)
        );
        // The way out: the entry is marked, offers no undo any more, and "reset all" forgets it.
        j.mark_stale(Kind::Tweak, "a").unwrap();
        assert_eq!(j.undo_steps(id), Err(JournalError::ChangedElsewhere));
        let v = &j.views()[0];
        assert!(v.stale && !v.can_undo && !v.undone);
        assert!(j.originals(Kind::Tweak).is_empty());
        let (j, _) = Journal::open(&path).unwrap();
        assert!(j.views()[0].stale, "kept across a restart");
        cleanup(&path);
    }

    #[test]
    fn reset_expects_what_the_newest_open_change_wrote() {
        let path = temp_path("resetwritten");
        let reg = MemRegistry::new();
        reg.set(KEY, "a", &Value::Dword(7)).unwrap();
        let (mut j, _) = Journal::open(&path).unwrap();
        switch(&mut j, &reg, "a", 0).unwrap();
        switch(&mut j, &reg, "a", 1).unwrap();
        // Untouched since: the reset goes back to the 7.
        let steps = j.originals(Kind::Tweak).remove(0).1;
        assert!(matches!(
            &steps[0],
            Undo::Reg {
                written: Some(Value::Dword(1)),
                ..
            }
        ));
        // Changed elsewhere since: the reset refuses and leaves it.
        reg.set(KEY, "a", &Value::Dword(5)).unwrap();
        assert_eq!(
            apply_undo(&reg, &steps, |_, _, _| Ok(())),
            Err(RegError::ChangedElsewhere)
        );
        assert_eq!(reg.get(KEY, "a"), Ok(Some(Value::Dword(5))));
        cleanup(&path);
    }

    #[test]
    fn other_steps_go_to_the_caller() {
        let reg = MemRegistry::new();
        let mut seen = Vec::new();
        apply_undo(
            &reg,
            &[Undo::Other {
                what: "powerScheme".into(),
                previous: "381b4222".into(),
                written: None,
            }],
            |what, previous, _| {
                seen.push(format!("{what}={previous}"));
                Ok(())
            },
        )
        .unwrap();
        assert_eq!(seen, vec!["powerScheme=381b4222"]);
    }

    #[test]
    fn a_broken_file_is_set_aside_and_reported() {
        let path = temp_path("broken");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, b"{ not json").unwrap();
        let (mut j, recovered) = Journal::open(&path).unwrap();
        assert!(recovered);
        assert!(j.views().is_empty());
        let mut bad = path.as_os_str().to_owned();
        bad.push(".bad");
        assert!(PathBuf::from(bad).exists());
        let reg = MemRegistry::new();
        switch(&mut j, &reg, "a", 1).unwrap();
        let (j, recovered) = Journal::open(&path).unwrap();
        assert!(!recovered);
        assert_eq!(j.views().len(), 1);
        cleanup(&path);
    }

    #[test]
    fn a_file_of_a_newer_version_and_a_second_broken_file_are_left_alone() {
        let path = temp_path("newer");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        let newer = br#"{"version":99,"nextId":1,"entries":[]}"#;
        std::fs::write(&path, newer).unwrap();
        assert_eq!(Journal::open(&path).err(), Some(JournalError::Unreadable));
        assert_eq!(std::fs::read(&path).unwrap(), newer);
        // An earlier `.bad` is never overwritten by a second recovery.
        let mut bad = path.as_os_str().to_owned();
        bad.push(".bad");
        std::fs::write(PathBuf::from(&bad), b"first").unwrap();
        std::fs::write(&path, b"{ broken").unwrap();
        assert_eq!(Journal::open(&path).err(), Some(JournalError::Unreadable));
        assert_eq!(std::fs::read(PathBuf::from(bad)).unwrap(), b"first");
        cleanup(&path);
    }

    #[test]
    fn a_file_that_cannot_be_read_is_an_error_and_stays_untouched() {
        // A folder where the file should be: reading fails with something other than "not found".
        let path = temp_path("locked");
        std::fs::create_dir_all(&path).unwrap();
        assert_eq!(Journal::open(&path).err(), Some(JournalError::Unreadable));
        assert!(path.is_dir(), "nothing was renamed or overwritten");
        cleanup(&path);
    }

    #[test]
    fn unknown_entries_are_an_error() {
        let path = temp_path("unknown");
        let (mut j, _) = Journal::open(&path).unwrap();
        assert_eq!(j.undo_steps(99), Err(JournalError::UnknownEntry));
        assert_eq!(j.mark_undone(99), Err(JournalError::UnknownEntry));
        cleanup(&path);
    }
}
