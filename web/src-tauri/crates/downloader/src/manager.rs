use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU64, AtomicU8, Ordering},
        Arc, Mutex, MutexGuard,
    },
    thread,
};

use serde::{Deserialize, Serialize};

use crate::{
    job::{HashCheck, Job, State},
    name::{file_name_from_url, unique_name},
    worker,
};

/// How many jobs download at the same time; the rest wait as `Queued`.
const MAX_PARALLEL: usize = 3;

/// Worker stop codes (shared flag per running job).
pub(crate) const RUN: u8 = 0;
pub(crate) const PAUSE: u8 = 1;
/// Remove the job; keep the files.
pub(crate) const REMOVE_KEEP: u8 = 2;
/// Remove the job and delete its partial file.
pub(crate) const REMOVE_DELETE: u8 = 3;

#[derive(Debug, PartialEq, Eq)]
pub enum AddError {
    /// Not an address.
    Url,
    /// Only `http://` and `https://`.
    Scheme,
    /// The folder is not an existing absolute directory.
    Dir,
    /// The pasted hash is neither SHA-256 (64) nor SHA-512 (128 hex characters).
    Hash,
}

impl AddError {
    pub fn code(&self) -> &'static str {
        match self {
            AddError::Url => "url",
            AddError::Scheme => "scheme",
            AddError::Dir => "dir",
            AddError::Hash => "hash",
        }
    }
}

#[derive(Serialize, Deserialize, Default)]
struct Saved {
    #[serde(default)]
    next_id: u64,
    #[serde(default)]
    global_bps: u64,
    #[serde(default)]
    jobs: Vec<Job>,
}

pub(crate) struct Inner {
    state_file: PathBuf,
    /// One `persist` at a time: commands and worker threads share the temporary file.
    persist_gate: Mutex<()>,
    pub(crate) jobs: Mutex<Vec<Job>>,
    flags: Mutex<HashMap<u64, Arc<AtomicU8>>>,
    pub(crate) global_bps: AtomicU64,
    next_id: AtomicU64,
    notify: Arc<dyn Fn() + Send + Sync>,
}

fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

pub(crate) fn valid_hash(h: &str) -> bool {
    matches!(h.len(), 64 | 128) && h.bytes().all(|b| b.is_ascii_hexdigit())
}

impl Inner {
    pub(crate) fn notify(&self) {
        (self.notify)();
    }

    pub(crate) fn update(&self, id: u64, f: impl FnOnce(&mut Job)) {
        if let Some(j) = lock(&self.jobs).iter_mut().find(|j| j.id == id) {
            f(j);
        }
    }

    pub(crate) fn job(&self, id: u64) -> Option<Job> {
        lock(&self.jobs).iter().find(|j| j.id == id).cloned()
    }

    pub(crate) fn running(&self) -> usize {
        lock(&self.flags).len()
    }

    /// Names already used by other jobs of the same folder (so two jobs never pick the same file).
    pub(crate) fn name_taken(&self, dir: &Path, name: &str, except: u64) -> bool {
        lock(&self.jobs)
            .iter()
            .any(|j| j.id != except && j.dir == dir && j.file_name == name)
    }

    /// Writes the job list (atomically: temp file, then rename). Called from command and worker threads;
    /// the gate covers snapshot, write and rename, so the last caller always writes the newest state.
    /// The `jobs` lock is held only for the copy, never during the file write. Never call this while
    /// holding the `jobs` lock.
    pub(crate) fn persist(&self) {
        let _gate = lock(&self.persist_gate);
        let saved = Saved {
            next_id: self.next_id.load(Ordering::Relaxed),
            global_bps: self.global_bps.load(Ordering::Relaxed),
            jobs: lock(&self.jobs).clone(),
        };
        if let Ok(json) = serde_json::to_vec_pretty(&saved) {
            let tmp = self.state_file.with_extension("json.tmp");
            if fs::write(&tmp, json).is_ok() {
                let _ = fs::rename(&tmp, &self.state_file);
            }
        }
    }

    /// Starts queued jobs while a slot is free.
    pub(crate) fn schedule(self: &Arc<Self>) {
        loop {
            let next = {
                let mut flags = lock(&self.flags);
                if flags.len() >= MAX_PARALLEL {
                    return;
                }
                let mut jobs = lock(&self.jobs);
                let Some(job) = jobs.iter_mut().find(|j| j.state == State::Queued) else {
                    return;
                };
                job.state = State::Running;
                job.error = None;
                let flag = Arc::new(AtomicU8::new(RUN));
                flags.insert(job.id, flag.clone());
                (job.id, flag)
            };
            let inner = self.clone();
            let (id, flag) = next;
            thread::spawn(move || {
                worker::run(&inner, id, &flag);
                lock(&inner.flags).remove(&id);
                inner.persist();
                inner.notify();
                inner.schedule();
            });
        }
    }
}

/// The download manager. Cheap to clone; all clones share the jobs.
#[derive(Clone)]
pub struct Manager(pub(crate) Arc<Inner>);

impl Manager {
    /// Opens (or creates) the job list at `state_file`. Jobs that were running when the program ended
    /// come back as `Paused` with their partial file; nothing starts by itself.
    pub fn open(state_file: PathBuf, notify: Arc<dyn Fn() + Send + Sync>) -> Manager {
        let saved: Saved = fs::read(&state_file)
            .ok()
            .and_then(|b| serde_json::from_slice(&b).ok())
            .unwrap_or_default();
        let mut jobs = saved.jobs;
        let next = jobs.iter().map(|j| j.id).max().unwrap_or(0) + 1;
        for j in &mut jobs {
            j.speed_bps = 0;
            if matches!(j.state, State::Running | State::Queued) {
                j.state = State::Paused;
            }
            if j.state == State::Paused {
                // The partial file is the truth (the saved number can be a little behind).
                j.done = fs::metadata(j.part_path()).map(|m| m.len()).unwrap_or(0);
            }
        }
        Manager(Arc::new(Inner {
            state_file,
            persist_gate: Mutex::new(()),
            jobs: Mutex::new(jobs),
            flags: Mutex::new(HashMap::new()),
            global_bps: AtomicU64::new(saved.global_bps),
            next_id: AtomicU64::new(saved.next_id.max(next)),
            notify,
        }))
    }

    pub fn snapshot(&self) -> Vec<Job> {
        lock(&self.0.jobs).clone()
    }

    pub fn global_limit(&self) -> u64 {
        self.0.global_bps.load(Ordering::Relaxed)
    }

    /// Adds a job and queues it. `dir` must be an existing absolute folder; the file name comes from the
    /// address (a `Content-Disposition` name replaces it when the download starts).
    pub fn add(&self, url: &str, dir: &Path, expected_hash: Option<&str>) -> Result<Job, AddError> {
        let parsed = url::Url::parse(url.trim()).map_err(|_| AddError::Url)?;
        if !matches!(parsed.scheme(), "http" | "https") || parsed.host_str().is_none() {
            return Err(AddError::Scheme);
        }
        if !dir.is_absolute() || !dir.is_dir() {
            return Err(AddError::Dir);
        }
        let hash = match expected_hash.map(str::trim).filter(|h| !h.is_empty()) {
            Some(h) if valid_hash(h) => Some(h.to_ascii_lowercase()),
            Some(_) => return Err(AddError::Hash),
            None => None,
        };
        let id = self.0.next_id.fetch_add(1, Ordering::Relaxed);
        let name = unique_name(dir, &file_name_from_url(&parsed), &|n| {
            self.0.name_taken(dir, n, id)
        });
        let job = Job {
            id,
            url: parsed.to_string(),
            file_name: name,
            dir: dir.to_path_buf(),
            state: State::Queued,
            done: 0,
            total: None,
            limit_bps: 0,
            speed_bps: 0,
            error: None,
            sha256: None,
            expected_hash: hash,
            hash_check: None,
        };
        lock(&self.0.jobs).push(job.clone());
        self.0.persist();
        self.0.notify();
        self.0.schedule();
        Ok(job)
    }

    pub fn pause(&self, id: u64) {
        let flag = lock(&self.0.flags).get(&id).cloned();
        match flag {
            Some(f) => f.store(PAUSE, Ordering::Relaxed),
            None => {
                self.0.update(id, |j| {
                    if j.state == State::Queued {
                        j.state = State::Paused;
                    }
                });
                self.0.persist();
                self.0.notify();
            }
        }
    }

    /// Continues a paused or failed job (a checksum failure starts from zero: the file was deleted).
    pub fn resume(&self, id: u64) {
        self.0.update(id, |j| {
            if matches!(j.state, State::Paused | State::Failed) {
                j.state = State::Queued;
                j.error = None;
                j.hash_check = None;
            }
        });
        self.0.persist();
        self.0.notify();
        self.0.schedule();
    }

    /// Removes the job from the list. `delete_data`: also delete the partial file and a finished file.
    pub fn remove(&self, id: u64, delete_data: bool) {
        let flag = lock(&self.0.flags).get(&id).cloned();
        let job = {
            let mut jobs = lock(&self.0.jobs);
            jobs.iter().position(|j| j.id == id).map(|i| jobs.remove(i))
        };
        let Some(job) = job else { return };
        if let Some(f) = flag {
            // The worker is still running: it stops, and deletes the partial file when asked to.
            f.store(
                if delete_data {
                    REMOVE_DELETE
                } else {
                    REMOVE_KEEP
                },
                Ordering::Relaxed,
            );
        } else if delete_data {
            let _ = fs::remove_file(job.part_path());
            if job.state == State::Done {
                let _ = fs::remove_file(job.final_path());
            }
        }
        self.0.persist();
        self.0.notify();
    }

    /// Speed limit for all downloads together, bytes per second; 0 = none.
    pub fn set_global_limit(&self, bps: u64) {
        self.0.global_bps.store(bps, Ordering::Relaxed);
        self.0.persist();
    }

    /// Speed limit of one job, bytes per second; 0 = none.
    pub fn set_job_limit(&self, id: u64, bps: u64) {
        self.0.update(id, |j| j.limit_bps = bps);
        self.0.persist();
        self.0.notify();
    }

    /// Compares a finished file with a pasted hash (SHA-256 or SHA-512); runs in the background.
    pub fn verify(&self, id: u64, expected: &str) -> Result<(), AddError> {
        let expected = expected.trim().to_ascii_lowercase();
        if !valid_hash(&expected) {
            return Err(AddError::Hash);
        }
        let Some(job) = self.0.job(id).filter(|j| j.state == State::Done) else {
            return Ok(());
        };
        self.0.update(id, |j| {
            j.expected_hash = Some(expected.clone());
            j.hash_check = None;
        });
        let inner = self.0.clone();
        thread::spawn(move || {
            let actual = worker::hash_file(&job.final_path(), expected.len() == 128);
            let check = match actual {
                Some(a) if a == expected => Some(HashCheck::Match),
                Some(_) => Some(HashCheck::Mismatch),
                None => None,
            };
            inner.update(id, |j| j.hash_check = check);
            inner.persist();
            inner.notify();
        });
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Barrier;

    fn job(id: u64, dir: &Path, note: &str) -> Job {
        Job {
            id,
            url: format!("https://example.invalid/{id}/{note}"),
            file_name: format!("file-{id}-{note}.bin"),
            dir: dir.to_path_buf(),
            state: State::Paused,
            done: id,
            total: None,
            limit_bps: 0,
            speed_bps: 0,
            error: None,
            sha256: None,
            expected_hash: None,
            hash_check: None,
        }
    }

    /// The state file as JSON; panics when it is missing or not a complete document.
    fn on_disk(path: &Path) -> serde_json::Value {
        let bytes = fs::read(path).expect("state file exists");
        let saved: Saved = serde_json::from_slice(&bytes).expect("state file parses");
        serde_json::to_value(saved).unwrap()
    }

    fn in_memory(inner: &Inner) -> serde_json::Value {
        serde_json::to_value(Saved {
            next_id: inner.next_id.load(Ordering::Relaxed),
            global_bps: inner.global_bps.load(Ordering::Relaxed),
            jobs: lock(&inner.jobs).clone(),
        })
        .unwrap()
    }

    /// Commands and worker threads persist at the same moment. Whatever the order, the file must be a
    /// complete document and, once all of them are back, show the newest state.
    #[test]
    fn concurrent_persist_keeps_the_file_whole_and_newest() {
        const THREADS: u64 = 8;
        const ROUNDS: u64 = 60;
        let root = std::env::temp_dir().join(format!("dl-persist-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let state = root.join("downloads.json");
        let manager = Manager::open(state.clone(), Arc::new(|| {}));
        // A list long enough that one write takes a moment.
        lock(&manager.0.jobs).extend((1..=200).map(|id| job(id, &root, "base")));

        for round in 0..ROUNDS {
            let barrier = Arc::new(Barrier::new(THREADS as usize));
            let handles: Vec<_> = (0..THREADS)
                .map(|t| {
                    let inner = manager.0.clone();
                    let barrier = barrier.clone();
                    let dir = root.clone();
                    thread::spawn(move || {
                        barrier.wait();
                        let id = 1000 + round * THREADS + t;
                        // Every change alters the length of the document, so a mixed write cannot pass.
                        {
                            let mut jobs = lock(&inner.jobs);
                            match t % 3 {
                                0 => jobs.push(job(id, &dir, &"x".repeat((id % 40) as usize))),
                                1 => {
                                    let at = (id as usize) % jobs.len();
                                    jobs[at].error = Some("y".repeat((id % 50) as usize));
                                }
                                _ => {
                                    let at = (id as usize) % jobs.len();
                                    jobs.remove(at);
                                }
                            }
                        }
                        inner.global_bps.store(id, Ordering::Relaxed);
                        inner.next_id.fetch_add(1, Ordering::Relaxed);
                        inner.persist();
                    })
                })
                .collect();
            for h in handles {
                h.join().unwrap();
            }
            assert_eq!(
                on_disk(&state),
                in_memory(&manager.0),
                "round {round}: the file is not the newest state"
            );
        }
        assert!(!state.with_extension("json.tmp").exists());
        let _ = fs::remove_dir_all(&root);
    }
}
