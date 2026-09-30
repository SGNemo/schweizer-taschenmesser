//! Deleting against temporary folders with invented files: plan, block list, trash (mock),
//! permanent delete, cancel, partial failures and the tree update.

use disk_scan::{
    apply_to_tree, execute, plan, DeleteControl, Denied, Flag, Guard, Mode, NodeKind, Outcome,
    Query, QueryScope, ScanControl, ScanOptions, TrashError, Trasher, Tree,
};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

struct TempDir(PathBuf);
impl TempDir {
    fn new(tag: &str) -> TempDir {
        static N: AtomicU64 = AtomicU64::new(0);
        let dir = std::env::temp_dir().join(format!(
            "tm-disk-del-{tag}-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&dir).unwrap();
        // Resolve once so that expected paths match what the guard returns (e.g. /tmp symlinks).
        TempDir(fs::canonicalize(dir).unwrap())
    }
    fn path(&self) -> &Path {
        &self.0
    }
}
impl Drop for TempDir {
    fn drop(&mut self) {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fn open_up(p: &Path) {
                if let Ok(rd) = fs::read_dir(p) {
                    let _ = fs::set_permissions(p, fs::Permissions::from_mode(0o755));
                    for e in rd.flatten() {
                        if e.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                            open_up(&e.path());
                        }
                    }
                }
            }
            open_up(&self.0);
        }
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn write(p: &Path, bytes: usize) {
    fs::create_dir_all(p.parent().unwrap()).unwrap();
    fs::write(p, vec![1u8; bytes]).unwrap();
}

/// data/{keep/k.bin, junk/{a.bin, sub/b.bin}, single.bin, empty/}, protected/p.bin
fn fixture() -> TempDir {
    let t = TempDir::new("fx");
    write(&t.path().join("keep/k.bin"), 5000);
    write(&t.path().join("junk/a.bin"), 6000);
    write(&t.path().join("junk/sub/b.bin"), 7000);
    write(&t.path().join("single.bin"), 8000);
    write(&t.path().join("protected/p.bin"), 9000);
    fs::create_dir_all(t.path().join("empty")).unwrap();
    t
}

fn scan_tree(root: &Path) -> Tree {
    disk_scan::scan(
        root,
        &ScanOptions {
            min_file_bytes: 1,
            threads: 2,
            ..Default::default()
        },
        &ScanControl::default(),
        |_| {},
    )
    .unwrap()
    .tree
}

fn find(tree: &Tree, name: &str) -> u32 {
    tree.children(0, 6, 0)
        .into_iter()
        .find(|n| n.name == name)
        .unwrap_or_else(|| panic!("{name} not in tree"))
        .id
}

fn guard_for(root: &Path) -> Guard {
    let mut g = Guard::new(false, false);
    g.protect_tree(&root.join("protected").to_string_lossy(), Denied::OwnApp);
    g
}

/// Moves items into a "bin" folder, or refuses named ones like a network drive would.
struct MockBin {
    bin: PathBuf,
    refuse: Vec<&'static str>,
    seen: Mutex<Vec<PathBuf>>,
}
impl Trasher for MockBin {
    fn trash(&self, path: &Path) -> Result<(), TrashError> {
        self.seen.lock().unwrap().push(path.to_path_buf());
        let name = path.file_name().unwrap().to_string_lossy().into_owned();
        if self.refuse.iter().any(|r| *r == name) {
            return Err(TrashError::Unavailable);
        }
        fs::create_dir_all(&self.bin).unwrap();
        fs::rename(path, self.bin.join(&name)).map_err(|_| TrashError::Failed("other"))
    }
}
fn bin_for(t: &TempDir, refuse: Vec<&'static str>) -> (MockBin, TempDir) {
    let bin = TempDir::new("bin");
    (
        MockBin {
            bin: bin.path().to_path_buf(),
            refuse,
            seen: Mutex::new(Vec::new()),
        },
        {
            let _ = t;
            bin
        },
    )
}

fn run(p: &disk_scan::Plan, mode: Mode, g: &Guard, tr: &dyn Trasher) -> disk_scan::Report {
    execute(p, mode, g, tr, &DeleteControl::default(), &|_| {})
}

#[test]
fn plan_refuses_root_aggregates_protected_and_missing_entries() {
    let t = fixture();
    let tree = scan_tree(t.path());
    let g = guard_for(t.path());
    let protected = find(&tree, "protected");
    let junk = find(&tree, "junk");
    // A "small files" aggregate exists when files are folded; scan again with a high threshold.
    let folded = disk_scan::scan(
        t.path(),
        &ScanOptions {
            min_file_bytes: 1 << 30,
            threads: 2,
            ..Default::default()
        },
        &ScanControl::default(),
        |_| {},
    )
    .unwrap()
    .tree;
    let small = folded
        .children(0, 3, 0)
        .into_iter()
        .find(|n| n.kind == NodeKind::Small)
        .unwrap()
        .id;

    let p = plan(&tree, &g, &[], &[0, protected, junk, 9999]);
    assert_eq!(
        p.items.iter().map(|i| i.name.as_str()).collect::<Vec<_>>(),
        ["junk"]
    );
    let denied: Vec<_> = p.denied.iter().map(|(_, d)| *d).collect();
    assert!(denied.contains(&Denied::ScanRoot));
    assert!(denied.contains(&Denied::OwnApp));
    assert!(denied.contains(&Denied::Missing));
    let p = plan(&folded, &g, &[], &[small]);
    assert_eq!(p.denied[0].1, Denied::NotAnEntry);
}

#[test]
fn nested_selections_collapse_into_the_parent() {
    let t = fixture();
    let tree = scan_tree(t.path());
    let g = guard_for(t.path());
    let (junk, sub, a) = (
        find(&tree, "junk"),
        find(&tree, "sub"),
        find(&tree, "a.bin"),
    );
    let p = plan(&tree, &g, &[], &[sub, a, junk, junk]);
    assert_eq!(p.items.len(), 1);
    assert_eq!(p.items[0].node, junk);
    assert_eq!(p.items[0].files, 2);
}

#[test]
fn flags_and_the_confirmation_phrase() {
    let t = fixture();
    write(&t.path().join("tool/app.exe"), 100);
    let tree = scan_tree(t.path());
    let g = guard_for(t.path());
    let user = vec![t.path().join("keep").to_string_lossy().into_owned()];
    let (keep, junk, tool) = (
        find(&tree, "keep"),
        find(&tree, "junk"),
        find(&tree, "tool"),
    );
    let p = plan(&tree, &g, &user, &[keep, tool, junk]);
    let by = |n: &str| p.items.iter().find(|i| i.name == n).unwrap();
    assert!(by("keep").flags.contains(&Flag::UserData));
    assert!(by("tool").flags.contains(&Flag::Program));
    assert!(by("junk").flags.is_empty());

    let one = plan(&tree, &g, &[], &[junk]);
    assert_eq!(one.required_confirmation(Mode::Trash), None);
    assert_eq!(
        one.required_confirmation(Mode::Permanent).as_deref(),
        Some("junk")
    );
    let many = plan(&tree, &g, &[], &[junk, keep]);
    assert_eq!(
        many.required_confirmation(Mode::Permanent).as_deref(),
        Some("LÖSCHEN")
    );
}

#[test]
fn trash_moves_entries_and_the_tree_is_corrected_without_a_rescan() {
    let t = fixture();
    let mut tree = scan_tree(t.path());
    let g = guard_for(t.path());
    let before = tree.view(0).unwrap();
    let junk = find(&tree, "junk");
    let junk_bytes = tree.view(junk).unwrap().bytes;
    let (mock, _bin) = bin_for(&t, vec![]);
    let p = plan(&tree, &g, &[], &[junk]);
    let r = run(&p, Mode::Trash, &g, &mock);
    assert_eq!(r.items[0].outcome, Outcome::Deleted);
    assert!(!t.path().join("junk").exists());
    assert_eq!(mock.seen.lock().unwrap().len(), 1);

    apply_to_tree(&mut tree, &r);
    let after = tree.view(0).unwrap();
    assert_eq!(after.bytes, before.bytes - junk_bytes);
    assert_eq!(after.files, before.files - 2);
    assert!(tree.view(junk).is_none());
    assert!(tree.path(junk).is_none());
    let names: Vec<_> = tree.children(0, 6, 0).into_iter().map(|n| n.name).collect();
    assert!(
        !names.contains(&"junk".to_string())
            && !names.contains(&"a.bin".to_string())
            && !names.contains(&"b.bin".to_string())
    );
    let files = tree.query(&Query {
        scope: QueryScope::Files,
        under: None,
        older_than: None,
        file_kind: None,
        min_bytes: None,
        limit: Some(50),
        only_empty: false,
    });
    assert!(files.iter().all(|f| f.name != "a.bin" && f.name != "b.bin"));
    assert!(!tree.remove(junk), "removing twice is a no-op");
}

#[test]
fn an_item_the_bin_refuses_is_reported_and_left_alone_never_deleted() {
    let t = fixture();
    let tree = scan_tree(t.path());
    let g = guard_for(t.path());
    let (mock, _bin) = bin_for(&t, vec!["junk"]);
    let p = plan(
        &tree,
        &g,
        &[],
        &[find(&tree, "junk"), find(&tree, "single.bin")],
    );
    let r = run(&p, Mode::Trash, &g, &mock);
    let of = |n: &str| r.items.iter().find(|i| i.name == n).unwrap().outcome;
    assert_eq!(of("junk"), Outcome::TrashUnavailable);
    assert_eq!(of("single.bin"), Outcome::Deleted);
    assert!(
        t.path().join("junk/a.bin").exists(),
        "nothing was removed for good"
    );
}

#[test]
fn permanent_delete_removes_everything_and_reports_the_bytes() {
    let t = fixture();
    let mut tree = scan_tree(t.path());
    let g = guard_for(t.path());
    let (mock, _bin) = bin_for(&t, vec![]);
    let progress = Mutex::new(Vec::new());
    let p = plan(
        &tree,
        &g,
        &[],
        &[
            find(&tree, "junk"),
            find(&tree, "single.bin"),
            find(&tree, "empty"),
        ],
    );
    let r = execute(
        &p,
        Mode::Permanent,
        &g,
        &mock,
        &DeleteControl::default(),
        &|d| progress.lock().unwrap().push(d.items_done),
    );
    assert!(r.items.iter().all(|i| i.outcome == Outcome::Deleted));
    assert_eq!(r.files_deleted, 3);
    assert!(r.freed_bytes >= 6000 + 7000 + 8000);
    assert!(
        !t.path().join("junk").exists()
            && !t.path().join("single.bin").exists()
            && !t.path().join("empty").exists()
    );
    assert!(t.path().join("keep/k.bin").exists());
    assert!(
        mock.seen.lock().unwrap().is_empty(),
        "permanent mode never touches the bin"
    );
    assert_eq!(progress.lock().unwrap().last(), Some(&3));
    apply_to_tree(&mut tree, &r);
    assert_eq!(tree.view(0).unwrap().files, 2);
}

#[test]
fn a_cancelled_run_deletes_nothing_more() {
    let t = fixture();
    let tree = scan_tree(t.path());
    let g = guard_for(t.path());
    let (mock, _bin) = bin_for(&t, vec![]);
    let p = plan(
        &tree,
        &g,
        &[],
        &[find(&tree, "junk"), find(&tree, "single.bin")],
    );
    let control = DeleteControl::default();
    control.cancel();
    let r = execute(&p, Mode::Permanent, &g, &mock, &control, &|_| {});
    assert!(r.cancelled);
    assert!(r.items.iter().all(|i| i.outcome == Outcome::Cancelled));
    assert!(t.path().join("junk/a.bin").exists() && t.path().join("single.bin").exists());
}

#[test]
fn the_block_list_is_checked_again_right_before_deleting() {
    let t = fixture();
    let tree = scan_tree(t.path());
    let mut g = guard_for(t.path());
    let (mock, _bin) = bin_for(&t, vec![]);
    let p = plan(&tree, &g, &[], &[find(&tree, "junk")]);
    // Between plan and run the folder becomes protected (e.g. a program starts from it).
    g.protect_tree(
        &t.path().join("junk").to_string_lossy(),
        Denied::RunningProgram,
    );
    let r = run(&p, Mode::Permanent, &g, &mock);
    assert_eq!(r.items[0].outcome, Outcome::Skipped);
    assert_eq!(r.items[0].reason, Some("running-program"));
    assert!(t.path().join("junk/a.bin").exists());
}

#[cfg(unix)]
#[test]
fn a_folder_swapped_for_a_link_after_the_scan_is_not_deleted() {
    use std::os::unix::fs::symlink;
    let t = fixture();
    let tree = scan_tree(t.path());
    let g = guard_for(t.path());
    let (mock, _bin) = bin_for(&t, vec![]);
    let p = plan(&tree, &g, &[], &[find(&tree, "junk")]);
    fs::remove_dir_all(t.path().join("junk")).unwrap();
    symlink(t.path().join("protected"), t.path().join("junk")).unwrap();
    let r = run(&p, Mode::Permanent, &g, &mock);
    assert_eq!(r.items[0].outcome, Outcome::Skipped, "{:?}", r.items[0]);
    assert!(
        t.path().join("protected/p.bin").exists(),
        "the protected target is untouched"
    );
}

#[cfg(unix)]
#[test]
fn permanent_delete_removes_links_but_never_follows_them() {
    use std::os::unix::fs::symlink;
    let t = fixture();
    let outside = TempDir::new("outside");
    write(&outside.path().join("precious.txt"), 100);
    symlink(outside.path(), t.path().join("junk/link-out")).unwrap();
    let tree = scan_tree(t.path());
    let g = guard_for(t.path());
    let (mock, _bin) = bin_for(&t, vec![]);
    let p = plan(&tree, &g, &[], &[find(&tree, "junk")]);
    let r = run(&p, Mode::Permanent, &g, &mock);
    assert_eq!(r.items[0].outcome, Outcome::Deleted);
    assert!(!t.path().join("junk").exists());
    assert!(
        outside.path().join("precious.txt").exists(),
        "the link target must survive"
    );
}

#[cfg(unix)]
#[test]
fn files_that_cannot_be_removed_give_a_partial_report_with_reasons() {
    use std::os::unix::fs::PermissionsExt;
    // Root ignores permission bits.
    extern "C" {
        fn geteuid() -> u32;
    }
    // SAFETY: geteuid has no preconditions.
    if unsafe { geteuid() } == 0 {
        eprintln!("skipped: running as root");
        return;
    }
    let t = fixture();
    let tree = scan_tree(t.path());
    let g = guard_for(t.path());
    let (mock, _bin) = bin_for(&t, vec![]);
    let p = plan(&tree, &g, &[], &[find(&tree, "junk")]);
    // b.bin sits in a folder we may not modify: it cannot be unlinked.
    fs::set_permissions(t.path().join("junk/sub"), fs::Permissions::from_mode(0o555)).unwrap();
    let r = run(&p, Mode::Permanent, &g, &mock);
    let it = &r.items[0];
    assert_eq!(it.outcome, Outcome::Partial);
    assert_eq!(it.files_deleted, 1);
    assert!(it.errors_total >= 1);
    assert_eq!(it.errors[0].reason, "denied");
    assert!(it.errors[0].path.ends_with("b.bin"));
    assert!(
        !t.path().join("junk/a.bin").exists(),
        "the rest was still deleted"
    );
}

#[test]
fn real_paths_are_resolved_before_the_block_list_applies() {
    let t = fixture();
    let mut g = Guard::new(false, false);
    g.protect_tree(
        &t.path().join("protected").to_string_lossy(),
        Denied::OwnApp,
    );
    // `..` detours
    assert_eq!(
        g.check_path(&t.path().join("keep/../protected")).err(),
        Some(Denied::OwnApp)
    );
    assert_eq!(
        g.check_path(&t.path().join("keep/../protected/p.bin"))
            .err(),
        Some(Denied::OwnApp)
    );
    // Missing paths are refused, not guessed.
    assert_eq!(
        g.check_path(&t.path().join("nope")).err(),
        Some(Denied::Missing)
    );
    assert!(g.check_path(&t.path().join("junk")).is_ok());
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(t.path().join("protected"), t.path().join("alias")).unwrap();
        assert_eq!(
            g.check_path(&t.path().join("alias")).err(),
            Some(Denied::OwnApp)
        );
        assert_eq!(
            g.check_path(&t.path().join("alias/p.bin")).err(),
            Some(Denied::OwnApp)
        );
    }
}

#[test]
fn a_running_program_protects_its_folder() {
    let exe = std::env::current_exe().unwrap();
    let mut g = Guard::new(false, false);
    g.set_running(&[exe.to_string_lossy().into_owned()]);
    assert_eq!(g.check_path(&exe).err(), Some(Denied::RunningProgram));
    assert_eq!(
        g.check_path(exe.parent().unwrap()).err(),
        Some(Denied::RunningProgram)
    );
    assert!(
        disk_scan::running_programs()
            .iter()
            .any(|p| Path::new(p) == exe
                || fs::canonicalize(p).ok().as_deref() == Some(exe.as_path()))
    );
}

#[test]
fn empty_folders_are_found_by_query() {
    let t = fixture();
    fs::create_dir_all(t.path().join("keep/hollow/deeper")).unwrap();
    let tree = scan_tree(t.path());
    let hits = tree.query(&Query {
        scope: QueryScope::Dirs,
        under: None,
        older_than: None,
        file_kind: None,
        min_bytes: None,
        limit: None,
        only_empty: true,
    });
    let names: Vec<_> = hits.iter().map(|h| h.name.as_str()).collect();
    assert!(names.contains(&"empty") && names.contains(&"hollow") && names.contains(&"deeper"));
    assert!(!names.contains(&"keep") && !names.contains(&"junk"));
}
