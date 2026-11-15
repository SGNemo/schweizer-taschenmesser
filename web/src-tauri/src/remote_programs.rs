//! The PC's program list for remote control (desktop only). Rules: `docs/rules/remote-control.md`
//! ("Programs"); plan: `docs/design/remote-power-deep/PLAN.md`.
//!
//! * One list, kept on this PC only: `remote-programs.json` next to the trust list
//!   (`{v:1, entries:[{name, path}]}`, written atomically), at most [`MAX_ENTRIES`] entries. A
//!   name is the file's stem as one plain line of at most 40 characters; the path is that of an
//!   executable or a shortcut (`.exe`, `.lnk`) – never an argument. Never synced, never set over
//!   the network.
//! * A file that cannot be read, or holds anything else, is no list at all (nothing can be
//!   started); the next entry added at this PC replaces it.
//! * An entry is added only by the shell's own command after its file dialog and confirmation
//!   (`remote::remote_program_add`); removing one acts at once and holds for this run even if it
//!   cannot be written.
//! * A start comes from the hub's input session through the sink ([`ProgramsCore::start`]): the
//!   slot is looked up in the list as it is at that moment, under the number the phone was told –
//!   when the list changed since, nothing starts. The call into the system comes in as a closure
//!   from `remote::attach` ([`Env`]); this file holds no app handle and reaches no window or
//!   dialog code.
//!
//! No Tauri command starts a program. Nothing is logged.

use ::lan_sync::input::wire::{ProgramAnswer, MAX_PROGRAMS};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

/// Most entries of the list (the wire's limit).
pub const MAX_ENTRIES: usize = MAX_PROGRAMS;
/// Longest name of an entry, in characters.
pub const NAME_MAX_CHARS: usize = 40;
/// The file next to the trust list.
pub const FILE: &str = "remote-programs.json";

#[derive(Serialize, Deserialize)]
struct FileEntry {
    name: String,
    path: String,
}

#[derive(Serialize, Deserialize)]
struct FileList {
    v: u32,
    entries: Vec<FileEntry>,
}

/// One entry: what the phone is told, and what is opened.
#[derive(Clone, PartialEq, Eq)]
pub struct Entry {
    pub name: String,
    pub path: PathBuf,
}

impl std::fmt::Debug for Entry {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Entry(..)")
    }
}

/// Why the list refused. Carries no name and no path.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ListError {
    /// Eight entries already.
    Full,
    /// That file is on the list already.
    Duplicate,
    /// Not an executable or a shortcut, or no name left.
    BadFile,
    NotFound,
    Storage,
}

impl ListError {
    pub fn name(self) -> &'static str {
        match self {
            ListError::Full => "full",
            ListError::Duplicate => "duplicate",
            ListError::BadFile => "bad-file",
            ListError::NotFound => "not-found",
            ListError::Storage => "failed",
        }
    }
}

/// Whether `path` may be an entry: absolute, and an executable or a shortcut by its extension.
pub fn allowed_path(path: &Path) -> bool {
    path.is_absolute()
        && path
            .extension()
            .and_then(|e| e.to_str())
            .is_some_and(|e| e.eq_ignore_ascii_case("exe") || e.eq_ignore_ascii_case("lnk"))
}

/// The name of an entry: the file's stem as one plain line (`plain` is the shell's sanitizer of
/// names in native texts), at most [`NAME_MAX_CHARS`] characters. `None` when nothing is left.
pub fn name_of(path: &Path, plain: impl Fn(&str) -> String) -> Option<String> {
    let stem = path.file_stem()?.to_string_lossy();
    let name: String = plain(&stem).chars().take(NAME_MAX_CHARS).collect();
    (!name.is_empty()).then_some(name)
}

/// The list as it is on disk and in memory.
pub struct ProgramList {
    file: PathBuf,
    entries: Vec<Entry>,
}

impl ProgramList {
    /// Reads the list. A missing file is an empty list; a file that cannot be read or holds
    /// anything else (more than eight entries, a name that is not a plain line, a path that is not
    /// an absolute `.exe` or `.lnk`) is an empty list too – nothing of it can be started.
    pub fn open(file: &Path, plain: impl Fn(&str) -> String) -> ProgramList {
        let entries = std::fs::read(file)
            .ok()
            .and_then(|bytes| serde_json::from_slice::<FileList>(&bytes).ok())
            .filter(|list| list.v == 1 && list.entries.len() <= MAX_ENTRIES)
            .and_then(|list| {
                list.entries
                    .into_iter()
                    .map(|e| {
                        let path = PathBuf::from(e.path);
                        let plain_name: String =
                            plain(&e.name).chars().take(NAME_MAX_CHARS).collect();
                        (allowed_path(&path) && !e.name.is_empty() && plain_name == e.name)
                            .then_some(Entry { name: e.name, path })
                    })
                    .collect::<Option<Vec<_>>>()
            })
            .unwrap_or_default();
        ProgramList {
            file: file.to_owned(),
            entries,
        }
    }

    #[cfg(test)]
    pub fn entries(&self) -> &[Entry] {
        &self.entries
    }

    fn write(&self, entries: &[Entry]) -> Result<(), ListError> {
        let list = FileList {
            v: 1,
            entries: entries
                .iter()
                .map(|e| FileEntry {
                    name: e.name.clone(),
                    path: e.path.to_string_lossy().into_owned(),
                })
                .collect(),
        };
        let bytes = serde_json::to_vec(&list).map_err(|_| ListError::Storage)?;
        let mut tmp = self.file.clone().into_os_string();
        tmp.push(".tmp");
        write_synced(Path::new(&tmp), &bytes).map_err(|_| ListError::Storage)?;
        std::fs::rename(&tmp, &self.file).map_err(|_| ListError::Storage)
    }

    /// Adds an entry (a widening: the caller asked at the PC first). Only once it is on disk.
    pub fn add(&mut self, entry: Entry) -> Result<(), ListError> {
        if self.entries.len() >= MAX_ENTRIES {
            return Err(ListError::Full);
        }
        if entry.name.is_empty()
            || entry.name.chars().count() > NAME_MAX_CHARS
            || !allowed_path(&entry.path)
        {
            return Err(ListError::BadFile);
        }
        if self.entries.iter().any(|e| e.path == entry.path) {
            return Err(ListError::Duplicate);
        }
        let mut next = self.entries.clone();
        next.push(entry);
        self.write(&next)?;
        self.entries = next;
        Ok(())
    }

    /// Removes an entry (a narrowing): at once, also when it cannot be written.
    pub fn remove(&mut self, slot: usize) -> Result<(), ListError> {
        if slot >= self.entries.len() {
            return Err(ListError::NotFound);
        }
        self.entries.remove(slot);
        self.write(&self.entries)
    }
}

/// Writes and flushes to disk before the caller renames the file into place.
fn write_synced(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    use std::io::Write;
    let mut f = std::fs::File::create(path)?;
    f.write_all(bytes)?;
    f.sync_all()
}

type LaunchFn = Box<dyn Fn(&Path) -> bool + Send + Sync>;

/// What the list needs from outside: the call that opens a file. Set while the hub runs
/// (`remote::attach`), so this file holds no app handle and no system call of its own.
pub struct Env {
    pub launch: LaunchFn,
}

/// The list of this PC, shared by the sink (hub threads) and the commands. One for the app: a hub
/// that is stopped and started keeps it (what was removed stays removed for this run).
#[derive(Default)]
pub struct ProgramsCore {
    list: Mutex<Option<ProgramList>>,
    /// Grows with every change of the list; the phone's start names the one it was told.
    version: AtomicU64,
    env: Mutex<Option<Arc<Env>>>,
}

impl ProgramsCore {
    fn list(&self) -> std::sync::MutexGuard<'_, Option<ProgramList>> {
        self.list.lock().unwrap_or_else(|e| e.into_inner())
    }

    fn changed(&self) {
        self.version.fetch_add(1, Ordering::SeqCst);
    }

    /// Reads the list of `file` once; the same file again keeps what is in memory.
    pub fn load(&self, file: &Path, plain: impl Fn(&str) -> String) {
        let mut list = self.list();
        if list.as_ref().is_some_and(|l| l.file == file) {
            return;
        }
        *list = Some(ProgramList::open(file, plain));
        self.changed();
    }

    pub fn attach(&self, env: Env) {
        if let Ok(mut e) = self.env.lock() {
            *e = Some(Arc::new(env));
        }
    }

    pub fn detach(&self) {
        if let Ok(mut e) = self.env.lock() {
            *e = None;
        }
    }

    /// The names in slot order, and the list's number (for the hub).
    pub fn programs(&self) -> (u64, Vec<String>) {
        let list = self.list();
        let names = list
            .as_ref()
            .map(|l| l.entries.iter().map(|e| e.name.clone()).collect())
            .unwrap_or_default();
        (self.version.load(Ordering::SeqCst), names)
    }

    /// A start that passed the hub's gate. The path is the one in the list now; a list that
    /// changed since the phone was told (`list`), an empty slot or a file that is gone start
    /// nothing.
    pub fn start(&self, slot: u8, list: u64) -> ProgramAnswer {
        let Some(env) = self.env.lock().ok().and_then(|e| e.clone()) else {
            return ProgramAnswer::Failed;
        };
        let path = {
            let entries = self.list();
            if self.version.load(Ordering::SeqCst) != list {
                return ProgramAnswer::Failed;
            }
            match entries
                .as_ref()
                .and_then(|l| l.entries.get(usize::from(slot)))
            {
                Some(e) => e.path.clone(),
                None => return ProgramAnswer::Failed,
            }
        };
        if !path.is_file() {
            return ProgramAnswer::Failed;
        }
        if (env.launch)(&path) {
            ProgramAnswer::Started
        } else {
            ProgramAnswer::Failed
        }
    }

    /// The entries for the PC's settings: names only (the page never gets a path).
    pub fn names(&self) -> Result<Vec<String>, ListError> {
        let list = self.list();
        let list = list.as_ref().ok_or(ListError::NotFound)?;
        Ok(list.entries.iter().map(|e| e.name.clone()).collect())
    }

    /// Whether another entry fits (`None`: no list loaded yet).
    pub fn has_room(&self) -> Option<bool> {
        self.list().as_ref().map(|l| l.entries.len() < MAX_ENTRIES)
    }

    /// Adds an entry the PC's owner chose and confirmed (`remote::remote_program_add`).
    pub fn add(&self, entry: Entry) -> Result<(), ListError> {
        let mut list = self.list();
        let added = list.as_mut().ok_or(ListError::NotFound)?.add(entry);
        if added.is_ok() {
            self.changed();
        }
        added
    }

    /// Removes an entry, at once.
    pub fn remove(&self, slot: usize) -> Result<(), ListError> {
        let mut list = self.list();
        let list = list.as_mut().ok_or(ListError::NotFound)?;
        let before = list.entries.len();
        let removed = list.remove(slot);
        if list.entries.len() != before {
            self.changed();
        }
        removed
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dir(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("nemo-programs-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    fn plain(s: &str) -> String {
        s.split_whitespace().collect::<Vec<_>>().join(" ")
    }

    /// An executable that exists, in `d`.
    fn exe(d: &Path, name: &str) -> PathBuf {
        let p = d.join(format!("{name}.exe"));
        std::fs::write(&p, b"MZ").unwrap();
        p
    }

    fn entry(d: &Path, name: &str) -> Entry {
        Entry {
            name: name.to_owned(),
            path: exe(d, name),
        }
    }

    #[test]
    fn the_list_survives_a_restart_and_keeps_only_names_and_paths() {
        let d = dir("roundtrip");
        let file = d.join(FILE);
        let mut list = ProgramList::open(&file, plain);
        assert!(list.entries().is_empty(), "a missing file is an empty list");
        list.add(entry(&d, "Editor")).unwrap();
        list.add(entry(&d, "Browser")).unwrap();
        let text = std::fs::read_to_string(&file).unwrap();
        assert!(text.starts_with(r#"{"v":1,"entries":[{"name":"Editor","path":"#));
        // nothing but name and path: no argument, no use
        for word in ["args", "arguments", "lastUsed", "count"] {
            assert!(!text.contains(word), "{word}");
        }
        let again = ProgramList::open(&file, plain);
        assert_eq!(again.entries(), list.entries());
        assert!(!d.join("remote-programs.json.tmp").exists());
        std::fs::remove_dir_all(d).ok();
    }

    #[test]
    fn eight_entries_at_most_each_file_once_and_only_executables_or_shortcuts() {
        let d = dir("limits");
        let mut list = ProgramList::open(&d.join(FILE), plain);
        for i in 0..MAX_ENTRIES {
            list.add(entry(&d, &format!("P{i}"))).unwrap();
        }
        assert_eq!(list.add(entry(&d, "Ninth")), Err(ListError::Full));
        list.remove(0).unwrap();
        assert_eq!(list.add(entry(&d, "P1")), Err(ListError::Duplicate));
        for bad in ["tool.bat", "tool.cmd", "tool.ps1", "tool", "relative.exe"] {
            let path = if bad.starts_with("relative") {
                PathBuf::from(bad)
            } else {
                d.join(bad)
            };
            let e = Entry {
                name: "X".into(),
                path,
            };
            assert_eq!(list.add(e), Err(ListError::BadFile), "{bad}");
        }
        let long = Entry {
            name: "x".repeat(41),
            path: d.join("long.exe"),
        };
        assert_eq!(list.add(long), Err(ListError::BadFile));
        let lnk = Entry {
            name: "Link".into(),
            path: d.join("Link.LNK"),
        };
        assert_eq!(list.add(lnk), Ok(()));
        assert_eq!(list.entries().len(), MAX_ENTRIES);
        std::fs::remove_dir_all(d).ok();
    }

    #[test]
    fn a_broken_file_is_no_list_and_never_a_guess() {
        let d = dir("broken");
        let file = d.join(FILE);
        let exe = exe(&d, "Ok").to_string_lossy().replace('\\', "\\\\");
        let good = format!(r#"{{"v":1,"entries":[{{"name":"Ok","path":"{exe}"}}]}}"#);
        std::fs::write(&file, &good).unwrap();
        assert_eq!(ProgramList::open(&file, plain).entries().len(), 1);
        let nine = format!(
            r#"{{"v":1,"entries":[{}]}}"#,
            vec![format!(r#"{{"name":"Ok","path":"{exe}"}}"#); 9].join(",")
        );
        for bad in [
            "{".to_owned(),
            good.replace(r#""v":1"#, r#""v":2"#),
            good.replace(r#""name":"Ok""#, r#""name":"""#),
            good.replace(r#""name":"Ok""#, r#""name":"O\nk""#),
            good.replace(r#""name":"Ok""#, &format!(r#""name":"{}""#, "x".repeat(41))),
            good.replace(".exe", ".bat"),
            good.replace(&exe, "Ok.exe"),
            nine,
        ] {
            std::fs::write(&file, &bad).unwrap();
            assert!(
                ProgramList::open(&file, plain).entries().is_empty(),
                "{bad}"
            );
        }
        // a directory where the file should be: nothing, and nothing written over it
        let as_dir = d.join("dir.json");
        std::fs::create_dir_all(&as_dir).unwrap();
        assert!(ProgramList::open(&as_dir, plain).entries().is_empty());
        std::fs::remove_dir_all(d).ok();
    }

    #[test]
    fn an_add_that_cannot_be_written_does_not_happen_and_a_removal_holds() {
        let d = dir("unwritable");
        let file = d.join(FILE);
        let mut list = ProgramList::open(&file, plain);
        list.add(entry(&d, "Editor")).unwrap();
        std::fs::create_dir_all(d.join("remote-programs.json.tmp")).unwrap();
        assert_eq!(list.add(entry(&d, "Browser")), Err(ListError::Storage));
        assert_eq!(list.entries().len(), 1, "not added");
        assert_eq!(list.remove(0), Err(ListError::Storage));
        assert!(list.entries().is_empty(), "removed all the same");
        assert_eq!(list.remove(0), Err(ListError::NotFound));
        std::fs::remove_dir_all(d).ok();
    }

    #[test]
    fn a_name_is_the_stem_as_one_plain_line_of_forty_characters() {
        assert_eq!(
            name_of(Path::new("/x/Obs  Studio.exe"), plain).as_deref(),
            Some("Obs Studio")
        );
        let long = format!("/x/{}.exe", "a".repeat(60));
        assert_eq!(
            name_of(Path::new(&long), plain).unwrap().chars().count(),
            40
        );
        assert_eq!(name_of(Path::new("/x/   .exe"), plain), None);
    }

    fn core_with(d: &Path, names: &[&str]) -> (ProgramsCore, Arc<Mutex<Vec<PathBuf>>>) {
        let core = ProgramsCore::default();
        core.load(&d.join(FILE), plain);
        for n in names {
            core.add(entry(d, n)).unwrap();
        }
        let opened = Arc::new(Mutex::new(Vec::new()));
        let seen = opened.clone();
        core.attach(Env {
            launch: Box::new(move |p| {
                seen.lock().unwrap().push(p.to_owned());
                true
            }),
        });
        (core, opened)
    }

    #[test]
    fn a_start_opens_the_path_of_the_list_as_it_is_now_and_nothing_else() {
        let d = dir("start");
        let (core, opened) = core_with(&d, &["Editor", "Browser"]);
        let (n, names) = core.programs();
        assert_eq!(names, ["Editor", "Browser"]);
        assert_eq!(core.start(1, n), ProgramAnswer::Started);
        assert_eq!(*opened.lock().unwrap(), [d.join("Browser.exe")]);
        // an empty slot, an old number, a file that is gone: nothing opens
        assert_eq!(core.start(2, n), ProgramAnswer::Failed);
        core.remove(0).unwrap();
        assert_eq!(core.start(0, n), ProgramAnswer::Failed, "the list changed");
        let (n, names) = core.programs();
        assert_eq!(names, ["Browser"]);
        std::fs::remove_file(d.join("Browser.exe")).unwrap();
        assert_eq!(core.start(0, n), ProgramAnswer::Failed, "gone");
        assert_eq!(opened.lock().unwrap().len(), 1);
        // without the hub's closure nothing opens at all
        core.add(entry(&d, "Spiel")).unwrap();
        core.detach();
        let (n, _) = core.programs();
        assert_eq!(core.start(1, n), ProgramAnswer::Failed);
        assert_eq!(opened.lock().unwrap().len(), 1);
        std::fs::remove_dir_all(d).ok();
    }

    #[test]
    fn the_list_is_read_once_and_every_change_moves_its_number() {
        let d = dir("version");
        let (core, _) = core_with(&d, &["Editor"]);
        let (a, _) = core.programs();
        core.load(&d.join(FILE), plain);
        assert_eq!(core.programs().0, a, "the same file is not read again");
        core.add(entry(&d, "Browser")).unwrap();
        let (b, _) = core.programs();
        assert!(b > a);
        assert_eq!(core.add(entry(&d, "Browser")), Err(ListError::Duplicate));
        assert_eq!(core.programs().0, b, "a refused add changes nothing");
        core.remove(5).unwrap_err();
        assert_eq!(core.programs().0, b);
        core.remove(0).unwrap();
        assert!(core.programs().0 > b);
        assert_eq!(core.has_room(), Some(true));
        assert_eq!(ProgramsCore::default().has_room(), None);
        std::fs::remove_dir_all(d).ok();
    }
}
