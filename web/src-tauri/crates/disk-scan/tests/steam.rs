//! Steam games in a scan: made-up libraries with invented app manifests and a local config.

use disk_scan::{scan, steam_games, ScanControl, ScanOptions};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

struct TempDir(PathBuf);

impl TempDir {
    fn new(tag: &str) -> TempDir {
        static N: AtomicU64 = AtomicU64::new(0);
        let dir = std::env::temp_dir().join(format!(
            "tm-disk-steam-{tag}-{}-{}",
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
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn manifest(steamapps: &Path, id: u32, name: &str, dir: &str, last_played: Option<i64>) {
    let played = last_played
        .map(|t| format!("\t\"LastPlayed\"\t\t\"{t}\"\n"))
        .unwrap_or_default();
    fs::write(
        steamapps.join(format!("appmanifest_{id}.acf")),
        format!(
            "\"AppState\"\n{{\n\t\"appid\"\t\t\"{id}\"\n\t\"name\"\t\t\"{name}\"\n\t\"installdir\"\t\t\"{dir}\"\n{played}}}\n"
        ),
    )
    .unwrap();
}

fn game(steamapps: &Path, dir: &str, bytes: usize) {
    let d = steamapps.join("common").join(dir);
    fs::create_dir_all(&d).unwrap();
    fs::write(d.join("data.pak"), vec![1u8; bytes]).unwrap();
}

/// Steam/{steamapps/{common/{Old Ferry, New Harbor, Fresh Install}, manifests}, userdata/...}
fn steam_folder() -> TempDir {
    let t = TempDir::new("lib");
    let apps = t.path().join("Steam").join("steamapps");
    fs::create_dir_all(&apps).unwrap();
    game(&apps, "Old Ferry", 3000);
    game(&apps, "New Harbor", 2000);
    game(&apps, "Fresh Install", 1000);
    manifest(
        &apps,
        100,
        "Old Ferry Deluxe",
        "Old Ferry",
        Some(1_500_000_000),
    );
    manifest(&apps, 200, "New Harbor", "New Harbor", None);
    manifest(&apps, 300, "Fresh Install", "Fresh Install", None);
    // Installed elsewhere / not in this library: no folder, so not listed.
    manifest(&apps, 400, "Gone Game", "Gone Game", Some(1_600_000_000));
    // A manifest that tries to point outside `common` is ignored.
    manifest(&apps, 500, "Sneaky", "..", Some(1_600_000_000));
    let cfg = t.path().join("Steam/userdata/12345/config");
    fs::create_dir_all(&cfg).unwrap();
    fs::write(
        cfg.join("localconfig.vdf"),
        "\"UserLocalConfigStore\"\n{\n \"Software\"\n {\n  \"valve\"\n  {\n   \"Steam\"\n   {\n    \"apps\"\n    {\n     \"100\" { \"LastPlayed\" \"1400000000\" }\n     \"200\" { \"LastPlayed\" \"1650000000\" \"Playtime\" \"12\" }\n    }\n   }\n  }\n }\n}\n",
    )
    .unwrap();
    t
}

fn opts() -> ScanOptions {
    ScanOptions {
        min_file_bytes: 1,
        threads: 2,
        ..Default::default()
    }
}

#[test]
fn games_get_the_newest_last_played_from_manifest_or_local_config() {
    let t = steam_folder();
    let r = scan(t.path(), &opts(), &ScanControl::default(), |_| {}).unwrap();
    let games = steam_games(&r.tree, &[]);
    let got: Vec<_> = games
        .iter()
        .map(|g| {
            (
                g.app_id,
                g.title.as_str(),
                g.node.name.as_str(),
                g.last_played,
            )
        })
        .collect();
    assert_eq!(
        got,
        [
            // Longest unplayed first; the manifest's date wins over an older local one.
            (100, "Old Ferry Deluxe", "Old Ferry", Some(1_500_000_000)),
            // Only the local config knows this one.
            (200, "New Harbor", "New Harbor", Some(1_650_000_000)),
            // Never started: no date, listed last.
            (300, "Fresh Install", "Fresh Install", None),
        ]
    );
    // The node is the install folder in the tree, with its parent path for the list.
    let old = &games[0].node;
    assert!(old.bytes >= 3000);
    let path = r.tree.path(old.id).unwrap();
    assert!(path.ends_with(Path::new("steamapps").join("common").join("Old Ferry")));
}

#[test]
fn scanning_the_library_or_its_common_folder_finds_the_games_too() {
    let t = steam_folder();
    let apps = t.path().join("Steam/steamapps");
    let r = scan(&apps, &opts(), &ScanControl::default(), |_| {}).unwrap();
    // The scan root's parent is the Steam folder: pass it like the registry would on Windows.
    let steam = [t.path().join("Steam")];
    let games = steam_games(&r.tree, &steam);
    assert_eq!(games.len(), 3);
    assert_eq!(games[1].last_played, Some(1_650_000_000));

    let r = scan(
        &apps.join("common"),
        &opts(),
        &ScanControl::default(),
        |_| {},
    )
    .unwrap();
    assert_eq!(steam_games(&r.tree, &[]).len(), 3);
}

#[test]
fn a_scan_without_steam_has_no_games() {
    let t = TempDir::new("none");
    fs::create_dir_all(t.path().join("steamapps")).unwrap(); // no `common`, no manifests
    fs::write(t.path().join("a.txt"), "x").unwrap();
    let r = scan(t.path(), &opts(), &ScanControl::default(), |_| {}).unwrap();
    assert!(steam_games(&r.tree, &[]).is_empty());
}
