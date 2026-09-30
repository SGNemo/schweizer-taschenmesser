//! Integration tests against temporary folders with invented files.

use disk_scan::{scan, NodeKind, Query, QueryScope, ScanControl, ScanOptions};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

struct TempDir(PathBuf);

impl TempDir {
    fn new(tag: &str) -> TempDir {
        static N: AtomicU64 = AtomicU64::new(0);
        let dir = std::env::temp_dir().join(format!(
            "tm-disk-scan-{tag}-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&dir).unwrap();
        TempDir(dir)
    }
    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        // Restore permissions a test may have removed, then clean up.
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(rd) = fs::read_dir(&self.0) {
                for e in rd.flatten() {
                    let _ = fs::set_permissions(e.path(), fs::Permissions::from_mode(0o755));
                }
            }
        }
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn write(dir: &Path, name: &str, bytes: usize) {
    fs::write(dir.join(name), vec![7u8; bytes]).unwrap();
}

fn opts(min_file_bytes: u64) -> ScanOptions {
    ScanOptions {
        min_file_bytes,
        threads: 4,
        ..Default::default()
    }
}

/// projects/{a.bin 5000, b.bin 300, sub/c.bin 9000}, media/{d.mp4 100000}, top.txt 10
fn fixture() -> TempDir {
    let t = TempDir::new("fixture");
    fs::create_dir_all(t.path().join("projects/sub")).unwrap();
    fs::create_dir_all(t.path().join("media")).unwrap();
    write(&t.path().join("projects"), "a.bin", 5000);
    write(&t.path().join("projects"), "b.bin", 300);
    write(&t.path().join("projects/sub"), "c.bin", 9000);
    write(&t.path().join("media"), "d.mp4", 100_000);
    write(t.path(), "top.txt", 10);
    t
}

#[test]
fn sums_match_the_files_on_disk() {
    let t = fixture();
    let r = scan(t.path(), &opts(1), &ScanControl::default(), |_| {}).unwrap();
    assert!(!r.cancelled);
    assert_eq!(r.files, 5);
    assert_eq!(r.dirs, 4); // root, projects, sub, media
    assert_eq!(r.logical_bytes, 5000 + 300 + 9000 + 100_000 + 10);
    assert!(
        r.bytes >= r.logical_bytes,
        "space on disk is at least the file size"
    );
    let root = r.tree.view(0).unwrap();
    assert_eq!(root.files, 5);
    assert_eq!(root.logical_bytes, r.logical_bytes);
    assert_eq!(root.bytes, r.bytes);
    assert_eq!(r.not_read_total, 0);
}

#[test]
fn small_files_are_folded_but_still_counted() {
    let t = fixture();
    // Threshold far above every file: nothing is kept as an own node.
    let r = scan(t.path(), &opts(1 << 30), &ScanControl::default(), |_| {}).unwrap();
    let root = r.tree.view(0).unwrap();
    assert_eq!(root.files, 5);
    assert_eq!(root.logical_bytes, 5000 + 300 + 9000 + 100_000 + 10);
    let all = r.tree.children(0, 4, 0);
    assert!(all.iter().all(|n| n.kind != NodeKind::File));
    assert!(all.iter().any(|n| n.kind == NodeKind::Small));
    // Threshold in between (on-disk sizes): only d.mp4 survives as an own node.
    let r = scan(t.path(), &opts(60_000), &ScanControl::default(), |_| {}).unwrap();
    let kept: Vec<_> = r
        .tree
        .children(0, 4, 0)
        .into_iter()
        .filter(|n| n.kind == NodeKind::File)
        .map(|n| n.name)
        .collect();
    assert_eq!(kept, ["d.mp4"]);
    assert_eq!(r.tree.view(0).unwrap().files, 5);
}

#[test]
fn queries_find_the_biggest_folder_and_file() {
    let t = fixture();
    let r = scan(t.path(), &opts(1), &ScanControl::default(), |_| {}).unwrap();
    let files = r.tree.query(&Query {
        scope: QueryScope::Files,
        under: None,
        older_than: None,
        file_kind: None,
        min_bytes: None,
        limit: Some(1),
    });
    assert_eq!(files[0].name, "d.mp4");
    let dirs = r.tree.query(&Query {
        scope: QueryScope::Dirs,
        under: None,
        older_than: None,
        file_kind: None,
        min_bytes: None,
        limit: Some(1),
    });
    assert_eq!(dirs[0].name, "media");
    let path = r.tree.path(files[0].id).unwrap();
    assert!(path.ends_with("media/d.mp4") || path.ends_with("media\\d.mp4"));
    assert!(path.is_file());
}

#[test]
fn a_cancelled_scan_stops_and_says_so() {
    let t = fixture();
    let control = ScanControl::default();
    control.cancel();
    let r = scan(t.path(), &opts(1), &control, |_| {}).unwrap();
    assert!(r.cancelled);
    assert_eq!(r.files, 0);
}

#[test]
fn cancelling_during_the_walk_returns_a_partial_tree() {
    let t = TempDir::new("cancel");
    for i in 0..300 {
        let d = t.path().join(format!("d{i}"));
        fs::create_dir_all(&d).unwrap();
        for j in 0..20 {
            write(&d, &format!("f{j}.txt"), 10);
        }
    }
    let control = ScanControl::default();
    let calls = Mutex::new(0);
    let r = scan(
        t.path(),
        &ScanOptions {
            threads: 2,
            ..opts(1)
        },
        &control,
        |p| {
            *calls.lock().unwrap() += 1;
            if p.files > 0 {
                control.cancel();
            }
        },
    )
    .unwrap();
    // The final progress call happens after the walk; whether the cancel arrived in time depends
    // on speed, so only the invariants are asserted.
    assert!(r.files <= 6000);
    assert_eq!(r.cancelled, control.is_cancelled());
    assert!(*calls.lock().unwrap() >= 1);
}

#[test]
fn progress_ends_with_the_totals() {
    let t = fixture();
    let last = Mutex::new(None);
    let r = scan(t.path(), &opts(1), &ScanControl::default(), |p| {
        *last.lock().unwrap() = Some(p)
    })
    .unwrap();
    let p = last.into_inner().unwrap().unwrap();
    assert_eq!(p.files, r.files);
    assert_eq!(p.bytes, r.bytes);
}

#[test]
fn missing_root_and_file_roots_are_errors() {
    let t = fixture();
    assert!(scan(
        &t.path().join("nope"),
        &opts(1),
        &ScanControl::default(),
        |_| {}
    )
    .is_err());
    assert!(scan(
        &t.path().join("top.txt"),
        &opts(1),
        &ScanControl::default(),
        |_| {}
    )
    .is_err());
}

#[test]
fn too_deep_folders_are_reported_not_entered() {
    let t = TempDir::new("deep");
    let mut p = t.path().to_path_buf();
    for i in 0..6 {
        p = p.join(format!("l{i}"));
    }
    fs::create_dir_all(&p).unwrap();
    write(&p, "deep.txt", 10);
    let r = scan(
        t.path(),
        &ScanOptions {
            max_depth: 3,
            ..opts(1)
        },
        &ScanControl::default(),
        |_| {},
    )
    .unwrap();
    assert_eq!(r.files, 0);
    assert_eq!(r.not_read.len(), 1);
    assert_eq!(r.not_read[0].reason, "too-deep");
}

#[cfg(unix)]
#[test]
fn symlinks_are_not_followed_or_counted() {
    use std::os::unix::fs::symlink;
    let t = TempDir::new("links");
    let real = t.path().join("real");
    fs::create_dir_all(&real).unwrap();
    write(&real, "big.bin", 50_000);
    symlink(&real, t.path().join("link-to-real")).unwrap();
    symlink(t.path(), real.join("loop")).unwrap(); // would recurse forever if followed
    symlink(real.join("big.bin"), t.path().join("link-to-file")).unwrap();
    let r = scan(t.path(), &opts(1), &ScanControl::default(), |_| {}).unwrap();
    assert_eq!(r.files, 1);
    assert_eq!(r.logical_bytes, 50_000);
    assert_eq!(r.skipped_links, 3);
}

#[cfg(unix)]
#[test]
fn unreadable_folders_are_listed_not_fatal() {
    use std::os::unix::fs::PermissionsExt;
    // Root ignores permission bits, so the situation cannot be produced there.
    // SAFETY: geteuid has no preconditions.
    if unsafe { libc_geteuid() } == 0 {
        eprintln!("skipped: running as root");
        return;
    }
    let t = fixture();
    let locked = t.path().join("locked");
    fs::create_dir_all(&locked).unwrap();
    write(&locked, "secret.txt", 100);
    fs::set_permissions(&locked, fs::Permissions::from_mode(0o000)).unwrap();
    let r = scan(t.path(), &opts(1), &ScanControl::default(), |_| {}).unwrap();
    assert_eq!(r.files, 5, "the readable part is still counted");
    assert_eq!(r.not_read_total, 1);
    assert_eq!(r.not_read[0].reason, "denied");
    assert!(r.not_read[0].path.ends_with("locked"));
}

#[cfg(unix)]
extern "C" {
    #[link_name = "geteuid"]
    fn libc_geteuid() -> u32;
}

/// `cargo test -p taschenmesser-disk-scan --release -- --ignored --nocapture perf`
/// Builds a synthetic tree (`DISK_SCAN_PERF_FILES`, default 300 000) and prints the timings.
#[test]
#[ignore]
fn perf_synthetic_tree() {
    let files: usize = std::env::var("DISK_SCAN_PERF_FILES")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(300_000);
    let t = TempDir::new("perf");
    let per_dir = 50;
    let dirs = files / per_dir;
    let make = std::time::Instant::now();
    for d in 0..dirs {
        let dir = t.path().join(format!("g{}", d % 100)).join(format!("d{d}"));
        fs::create_dir_all(&dir).unwrap();
        for f in 0..per_dir {
            fs::write(dir.join(format!("f{f}.dat")), [0u8; 16]).unwrap();
        }
    }
    println!(
        "created {files} files in {} dirs: {:?}",
        dirs,
        make.elapsed()
    );
    for threads in [1, 0] {
        let started = std::time::Instant::now();
        let r = scan(
            t.path(),
            &ScanOptions {
                threads,
                ..Default::default()
            },
            &ScanControl::default(),
            |_| {},
        )
        .unwrap();
        println!(
            "threads={threads}: {} files, {} dirs, {} nodes in tree, {:?}",
            r.files,
            r.dirs,
            r.tree.len(),
            started.elapsed()
        );
        let q = std::time::Instant::now();
        let _ = r.tree.children(0, 3, 0);
        println!("children(depth 3): {:?}", q.elapsed());
        assert_eq!(r.files as usize, dirs * per_dir);
    }
}
