use disk_scan::{find_duplicates, scan, ScanControl, ScanOptions};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

struct TempDir(PathBuf);
impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
fn temp(tag: &str) -> TempDir {
    static N: AtomicU64 = AtomicU64::new(0);
    let d = std::env::temp_dir().join(format!(
        "tm-disk-dup-{tag}-{}-{}",
        std::process::id(),
        N.fetch_add(1, Ordering::Relaxed)
    ));
    fs::create_dir_all(&d).unwrap();
    TempDir(d)
}
fn put(root: &Path, rel: &str, bytes: Vec<u8>) {
    let p = root.join(rel);
    fs::create_dir_all(p.parent().unwrap()).unwrap();
    fs::write(p, bytes).unwrap();
}
fn tree(root: &Path) -> disk_scan::Tree {
    scan(
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

#[test]
fn identical_files_are_grouped_and_lookalikes_are_not() {
    let t = temp("a");
    let r = &t.0;
    let same = vec![7u8; 10_000];
    put(r, "a/one.bin", same.clone());
    put(r, "b/two.bin", same.clone());
    put(r, "c/three.bin", same.clone());
    // same size, different content
    put(r, "a/other.bin", vec![9u8; 10_000]);
    // same first 64 KiB, different tail: only the full hash tells them apart
    let mut big1 = vec![1u8; 200_000];
    let mut big2 = big1.clone();
    big1[199_999] = 2;
    big2[199_999] = 3;
    put(r, "a/big1.bin", big1);
    put(r, "b/big2.bin", big2);
    put(r, "a/unique.bin", vec![5u8; 123]);
    let groups = find_duplicates(&tree(r), 0, &ScanControl::default());
    assert_eq!(groups.len(), 1, "{groups:?}");
    let g = &groups[0];
    assert_eq!(g.size, 10_000);
    assert_eq!(g.wasted, 20_000);
    let mut names: Vec<_> = g.files.iter().map(|f| f.name.clone()).collect();
    names.sort();
    assert_eq!(names, ["one.bin", "three.bin", "two.bin"]);
    assert!(g
        .files
        .iter()
        .all(|f| f.rel_path == "a" || f.rel_path == "b" || f.rel_path == "c"));
}

#[test]
fn groups_are_ranked_by_wasted_space_and_limited_to_a_subtree() {
    let t = temp("b");
    let r = &t.0;
    for i in 0..2 {
        put(r, &format!("x/small{i}.bin"), vec![1u8; 1000]);
        put(r, &format!("y/huge{i}.bin"), vec![2u8; 50_000]);
    }
    let tr = tree(r);
    let all = find_duplicates(&tr, 0, &ScanControl::default());
    assert_eq!(
        all.iter().map(|g| g.size).collect::<Vec<_>>(),
        [50_000, 1000]
    );
    let x = tr
        .children(0, 1, 0)
        .into_iter()
        .find(|n| n.name == "x")
        .unwrap()
        .id;
    let under = find_duplicates(&tr, x, &ScanControl::default());
    assert_eq!(under.len(), 1, "only the copies inside x count");
    assert_eq!(under[0].size, 1000);
}

#[test]
fn empty_files_and_a_cancelled_run_give_nothing() {
    let t = temp("c");
    let r = &t.0;
    put(r, "e1.txt", Vec::new());
    put(r, "e2.txt", Vec::new());
    put(r, "d1.bin", vec![3u8; 5000]);
    put(r, "d2.bin", vec![3u8; 5000]);
    let tr = tree(r);
    assert_eq!(
        find_duplicates(&tr, 0, &ScanControl::default()).len(),
        1,
        "empty files are not duplicates worth listing"
    );
    let control = ScanControl::default();
    control.cancel();
    assert!(find_duplicates(&tr, 0, &control).is_empty());
}
