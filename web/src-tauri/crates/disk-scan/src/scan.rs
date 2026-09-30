//! Parallel, read-only directory scan.
//!
//! One rayon task per folder; every task returns its own [`DirTemp`] (no shared tree, no locks on
//! the hot path) and the arena [`Tree`] is built once at the end. Symlinks, junctions and mount
//! points are never entered, unreadable folders are collected instead of failing the scan, and
//! cloud placeholders ("files on demand") are neither opened nor counted as local size.

use crate::kinds::{classify, KIND_COUNT};
use crate::tree::{DirTemp, FileTemp, SmallAgg, Tree};
use rayon::prelude::*;
use serde::Serialize;
use std::fs::{self, Metadata};
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering::Relaxed};
use std::sync::Mutex;
use std::time::{Duration, Instant, UNIX_EPOCH};

#[derive(Clone, Debug)]
pub struct ScanOptions {
    /// Files smaller than this are folded into one "small files" entry per folder.
    pub min_file_bytes: u64,
    /// Worker threads; 0 = number of CPUs minus one (at least 2).
    pub threads: usize,
    /// Folders deeper than this are not entered (recursion guard) and reported as not read.
    pub max_depth: usize,
    /// Cap of the "not read" list (the counter keeps counting).
    pub max_not_read: usize,
}

impl Default for ScanOptions {
    fn default() -> Self {
        ScanOptions {
            min_file_bytes: 1 << 20,
            threads: 0,
            max_depth: 512,
            max_not_read: 1000,
        }
    }
}

/// Cancel / pause flags shared with the caller.
#[derive(Default)]
pub struct ScanControl {
    cancel: AtomicBool,
    paused: AtomicBool,
}

impl ScanControl {
    pub fn cancel(&self) {
        self.cancel.store(true, Relaxed);
    }
    pub fn set_paused(&self, paused: bool) {
        self.paused.store(paused, Relaxed);
    }
    pub fn is_cancelled(&self) -> bool {
        self.cancel.load(Relaxed)
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub files: u64,
    pub dirs: u64,
    /// Space used on the volume so far.
    pub bytes: u64,
    pub current: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotRead {
    pub path: String,
    /// `denied` (access refused), `vanished` (deleted meanwhile), `too-deep` or `error`.
    pub reason: &'static str,
}

pub struct ScanResult {
    pub tree: Tree,
    pub files: u64,
    pub dirs: u64,
    pub bytes: u64,
    pub logical_bytes: u64,
    /// Size of files that are only online (cloud placeholders), not part of `bytes`.
    pub cloud_bytes: u64,
    pub skipped_links: u64,
    pub not_read: Vec<NotRead>,
    pub not_read_total: u64,
    pub cancelled: bool,
    pub elapsed_ms: u64,
}

struct Ctx<'a> {
    opts: &'a ScanOptions,
    control: &'a ScanControl,
    cluster: u64,
    files: AtomicU64,
    dirs: AtomicU64,
    bytes: AtomicU64,
    logical: AtomicU64,
    cloud: AtomicU64,
    links: AtomicU64,
    not_read_total: AtomicU64,
    not_read: Mutex<Vec<NotRead>>,
    current: Mutex<String>,
}

impl Ctx<'_> {
    fn record(&self, path: &Path, err: &io::Error) {
        self.not_read_total.fetch_add(1, Relaxed);
        let reason = match err.kind() {
            io::ErrorKind::PermissionDenied => "denied",
            io::ErrorKind::NotFound => "vanished",
            _ => "error",
        };
        self.push(path, reason);
    }

    fn push(&self, path: &Path, reason: &'static str) {
        let mut list = self.not_read.lock().unwrap_or_else(|e| e.into_inner());
        if list.len() < self.opts.max_not_read {
            list.push(NotRead {
                path: path.to_string_lossy().into_owned(),
                reason,
            });
        }
    }

    fn progress(&self) -> Progress {
        Progress {
            files: self.files.load(Relaxed),
            dirs: self.dirs.load(Relaxed),
            bytes: self.bytes.load(Relaxed),
            current: self
                .current
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .clone(),
        }
    }

    /// Blocks while paused; returns true when the scan was cancelled.
    fn should_stop(&self) -> bool {
        while self.control.paused.load(Relaxed) && !self.control.is_cancelled() {
            std::thread::sleep(Duration::from_millis(40));
        }
        self.control.is_cancelled()
    }
}

// --- platform bits -------------------------------------------------------------------------

#[cfg(windows)]
mod plat {
    use super::*;
    use std::os::windows::fs::MetadataExt;
    use windows::core::PCWSTR;
    use windows::Win32::Storage::FileSystem::GetDiskFreeSpaceW;

    const RECALL_ON_OPEN: u32 = 0x0004_0000;
    const RECALL_ON_DATA_ACCESS: u32 = 0x0040_0000;
    const OFFLINE: u32 = 0x0000_1000;

    /// Cloud placeholder (OneDrive "online only" etc.): reading it would download it.
    pub fn is_cloud(md: &Metadata) -> bool {
        md.file_attributes() & (RECALL_ON_OPEN | RECALL_ON_DATA_ACCESS | OFFLINE) != 0
    }

    pub fn size_on_disk(md: &Metadata, cluster: u64) -> u64 {
        let len = md.len();
        if cluster == 0 {
            return len;
        }
        len.div_ceil(cluster) * cluster
    }

    pub fn cluster_size(root: &Path) -> u64 {
        use std::path::Component;
        let Some(Component::Prefix(prefix)) = root.components().next() else {
            return 4096;
        };
        let mut vol: Vec<u16> =
            std::os::windows::ffi::OsStrExt::encode_wide(prefix.as_os_str()).collect();
        vol.push(u16::from(b'\\'));
        vol.push(0);
        let (mut spc, mut bps) = (0u32, 0u32);
        // SAFETY: `vol` is a NUL-terminated wide string that outlives the call; the out pointers
        // point to live locals.
        let ok = unsafe {
            GetDiskFreeSpaceW(
                PCWSTR(vol.as_ptr()),
                Some(&mut spc),
                Some(&mut bps),
                None,
                None,
            )
        };
        if ok.is_ok() && spc > 0 && bps > 0 {
            u64::from(spc) * u64::from(bps)
        } else {
            4096
        }
    }
}

#[cfg(not(windows))]
mod plat {
    use super::*;

    pub fn is_cloud(_md: &Metadata) -> bool {
        false
    }

    #[cfg(unix)]
    pub fn size_on_disk(md: &Metadata, _cluster: u64) -> u64 {
        use std::os::unix::fs::MetadataExt;
        md.blocks() * 512
    }

    #[cfg(not(unix))]
    pub fn size_on_disk(md: &Metadata, _cluster: u64) -> u64 {
        md.len()
    }

    pub fn cluster_size(_root: &Path) -> u64 {
        4096
    }
}

fn unix_secs(md: &Metadata) -> i64 {
    match md.modified().map(|t| t.duration_since(UNIX_EPOCH)) {
        Ok(Ok(d)) => d.as_secs() as i64,
        Ok(Err(e)) => -(e.duration().as_secs() as i64),
        Err(_) => 0,
    }
}

// --- the walk ------------------------------------------------------------------------------

fn scan_dir(path: &Path, name: String, depth: usize, ctx: &Ctx) -> DirTemp {
    let mut out = DirTemp {
        name,
        ..Default::default()
    };
    if ctx.should_stop() {
        return out;
    }
    if let Ok(mut cur) = ctx.current.try_lock() {
        cur.clear();
        cur.push_str(&path.to_string_lossy());
    }
    ctx.dirs.fetch_add(1, Relaxed);
    let entries = match fs::read_dir(path) {
        Ok(e) => e,
        Err(e) => {
            ctx.record(path, &e);
            return out;
        }
    };
    let mut subdirs: Vec<(PathBuf, String)> = Vec::new();
    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(e) => {
                ctx.record(path, &e);
                continue;
            }
        };
        let file_type = match entry.file_type() {
            Ok(t) => t,
            Err(e) => {
                ctx.record(&entry.path(), &e);
                continue;
            }
        };
        // Symlinks, junctions and mount points: never followed, never counted (no loops, no
        // double counting).
        if file_type.is_symlink() {
            ctx.links.fetch_add(1, Relaxed);
            continue;
        }
        let md = match entry.metadata() {
            Ok(m) => m,
            Err(e) => {
                ctx.record(&entry.path(), &e);
                continue;
            }
        };
        let file_name = entry.file_name().to_string_lossy().into_owned();
        if file_type.is_dir() {
            if plat::is_cloud(&md) {
                // A dehydrated folder: listing it could trigger a download.
                ctx.links.fetch_add(1, Relaxed);
                continue;
            }
            if depth + 1 > ctx.opts.max_depth {
                ctx.not_read_total.fetch_add(1, Relaxed);
                ctx.push(&entry.path(), "too-deep");
                continue;
            }
            subdirs.push((entry.path(), file_name));
        } else if file_type.is_file() {
            let modified = unix_secs(&md);
            let logical = md.len();
            let (bytes, logical_local) = if plat::is_cloud(&md) {
                ctx.cloud.fetch_add(logical, Relaxed);
                (0, 0)
            } else {
                (plat::size_on_disk(&md, ctx.cluster), logical)
            };
            ctx.files.fetch_add(1, Relaxed);
            ctx.bytes.fetch_add(bytes, Relaxed);
            ctx.logical.fetch_add(logical_local, Relaxed);
            if bytes >= ctx.opts.min_file_bytes {
                out.files.push(FileTemp {
                    name: file_name,
                    bytes,
                    logical: logical_local,
                    modified,
                });
            } else {
                add_small(&mut out.small, &file_name, bytes, logical_local, modified);
            }
        }
    }
    let children: Vec<DirTemp> = subdirs
        .into_par_iter()
        .map(|(p, n)| scan_dir(&p, n, depth + 1, ctx))
        .collect();
    out.dirs = children;
    out
}

fn add_small(agg: &mut SmallAgg, name: &str, bytes: u64, logical: u64, modified: i64) {
    agg.count += 1;
    agg.bytes += bytes;
    agg.logical += logical;
    agg.modified = agg.modified.max(modified);
    debug_assert_eq!(agg.kind_bytes.len(), KIND_COUNT);
    agg.kind_bytes[classify(name).index()] += bytes;
}

/// Scans `root` (a folder) in parallel. `on_progress` is called about every 100 ms from a helper
/// thread and once at the end. Returns an error only when `root` itself cannot be scanned.
pub fn scan<F>(
    root: &Path,
    opts: &ScanOptions,
    control: &ScanControl,
    on_progress: F,
) -> io::Result<ScanResult>
where
    F: Fn(Progress) + Sync,
{
    let md = fs::metadata(root)?;
    if !md.is_dir() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "not a directory",
        ));
    }
    let started = Instant::now();
    let threads = if opts.threads > 0 {
        opts.threads
    } else {
        std::thread::available_parallelism().map_or(2, |n| n.get().saturating_sub(1).max(2))
    };
    let pool = rayon::ThreadPoolBuilder::new()
        .num_threads(threads)
        .stack_size(16 << 20)
        .thread_name(|i| format!("disk-scan-{i}"))
        .build()
        .map_err(|e| io::Error::other(e.to_string()))?;
    let ctx = Ctx {
        opts,
        control,
        cluster: plat::cluster_size(root),
        files: AtomicU64::new(0),
        dirs: AtomicU64::new(0),
        bytes: AtomicU64::new(0),
        logical: AtomicU64::new(0),
        cloud: AtomicU64::new(0),
        links: AtomicU64::new(0),
        not_read_total: AtomicU64::new(0),
        not_read: Mutex::new(Vec::new()),
        current: Mutex::new(String::new()),
    };
    let done = AtomicBool::new(false);
    let temp = std::thread::scope(|s| {
        s.spawn(|| {
            let mut last = Instant::now();
            while !done.load(Relaxed) {
                std::thread::sleep(Duration::from_millis(20));
                if last.elapsed() >= Duration::from_millis(100) {
                    on_progress(ctx.progress());
                    last = Instant::now();
                }
            }
        });
        let t = pool.install(|| scan_dir(root, String::new(), 0, &ctx));
        done.store(true, Relaxed);
        t
    });
    on_progress(ctx.progress());
    let tree = pool.install(|| Tree::from_temp(root.to_path_buf(), temp));
    let not_read = ctx.not_read.into_inner().unwrap_or_else(|e| e.into_inner());
    Ok(ScanResult {
        tree,
        files: ctx.files.into_inner(),
        dirs: ctx.dirs.into_inner(),
        bytes: ctx.bytes.into_inner(),
        logical_bytes: ctx.logical.into_inner(),
        cloud_bytes: ctx.cloud.into_inner(),
        skipped_links: ctx.links.into_inner(),
        not_read,
        not_read_total: ctx.not_read_total.into_inner(),
        cancelled: control.is_cancelled(),
        elapsed_ms: started.elapsed().as_millis() as u64,
    })
}
