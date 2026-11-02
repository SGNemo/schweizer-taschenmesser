//! Engine tests on loopback: one seeder, one leecher in the same process, no DHT, no tracker, no
//! internet. The torrent is built here from generated files; nothing real is ever downloaded.

use std::{
    net::SocketAddr,
    path::{Path, PathBuf},
    time::{Duration, Instant},
};

use librqbit::{create_torrent, spawn_utils::BlockingSpawner, CreateTorrentOptions};
use torrent::{Engine, EngineConfig, SeedLimits, Source, TorrentInfo, TorrentState};

/// librqbit binds its UDP tracker client to `[::]` and cannot start without IPv6 in the kernel; such a
/// machine (a minimal container) skips these tests instead of failing them.
fn no_ipv6() -> bool {
    let missing = std::net::UdpSocket::bind("[::]:0").is_err();
    if missing {
        eprintln!("skipped: this machine has no IPv6");
    }
    missing
}

struct Env {
    root: PathBuf,
}

impl Env {
    fn new(name: &str) -> Env {
        let root = std::env::temp_dir().join(format!("tt-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).unwrap();
        Env { root }
    }
    fn dir(&self, name: &str) -> PathBuf {
        let d = self.root.join(name);
        std::fs::create_dir_all(&d).unwrap();
        d
    }
}

impl Drop for Env {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

fn bytes(len: usize, seed: usize) -> Vec<u8> {
    (0..len).map(|i| ((i * 31 + seed) % 251) as u8).collect()
}

/// File sizes are whole multiples of the 16 KiB piece length, so no piece spans two files and a
/// selection of files downloads exactly those.
const A: usize = 40 * 16384;
const B: usize = 24 * 16384;
const C: usize = 12 * 16384;
const TOTAL: u64 = (A + B + C) as u64;

/// `pack/{a.bin, b.bin, c.bin}` below `parent`; returns the `.torrent` bytes.
async fn make_pack(parent: &Path) -> Vec<u8> {
    let pack = parent.join("pack");
    std::fs::create_dir_all(&pack).unwrap();
    std::fs::write(pack.join("a.bin"), bytes(A, 1)).unwrap();
    std::fs::write(pack.join("b.bin"), bytes(B, 2)).unwrap();
    std::fs::write(pack.join("c.bin"), bytes(C, 3)).unwrap();
    let options = CreateTorrentOptions {
        piece_length: Some(16384),
        ..Default::default()
    };
    let t = create_torrent(&pack, options, &BlockingSpawner::new(1))
        .await
        .unwrap();
    t.as_bytes().unwrap().to_vec()
}

async fn engine(env: &Env, name: &str) -> Engine {
    Engine::start(EngineConfig {
        state_dir: env.dir(&format!("{name}-state")),
        default_dir: env.dir(&format!("{name}-default")),
        dht: false,
        trackers: false,
        listen: Some("127.0.0.1:0".parse().unwrap()),
        upnp: false,
        ipv4_only: true,
    })
    .await
    .unwrap()
}

async fn until(what: &str, mut ok: impl FnMut() -> bool) {
    let end = Instant::now() + Duration::from_secs(40);
    while !ok() {
        assert!(Instant::now() < end, "timeout waiting for {what}");
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
}

fn one(e: &Engine) -> TorrentInfo {
    e.list().into_iter().next().expect("a torrent")
}

/// A seeder that serves `pack` (already on disk) and the address a leecher connects to.
async fn seeder(env: &Env) -> (Engine, Vec<u8>, SocketAddr) {
    let seed_dir = env.dir("seed-files");
    let file = make_pack(&seed_dir).await;
    let e = engine(env, "seeder").await;
    e.add(Source::File(file.clone()), &seed_dir, None, vec![])
        .await
        .unwrap();
    let end = Instant::now() + Duration::from_secs(40);
    while !e
        .list()
        .first()
        .is_some_and(|t| t.state == TorrentState::Seeding)
    {
        assert!(
            Instant::now() < end,
            "seeder never completed: {:?}",
            e.list()
        );
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    let addr = e.listen_addr().expect("listen address");
    (e, file, addr)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn preview_lists_files_and_selection_downloads_only_those() {
    if no_ipv6() {
        return;
    }
    let env = Env::new("select");
    let (_seed, file, addr) = seeder(&env).await;
    let leech = engine(&env, "leech").await;
    let preview = leech
        .preview(Source::File(file.clone()), vec![addr])
        .await
        .unwrap();
    assert_eq!(preview.name, "pack");
    assert_eq!(preview.total, TOTAL);
    let names: Vec<_> = preview.files.iter().map(|f| f.path.as_str()).collect();
    assert_eq!(names, ["a.bin", "b.bin", "c.bin"]);
    assert!(leech.list().is_empty(), "a preview adds nothing");

    let out = env.dir("out");
    leech
        .add(Source::File(file), &out, Some(vec![0, 1]), vec![addr])
        .await
        .unwrap();
    until("selected files done", || {
        one(&leech).progress_bytes >= 500_000
    })
    .await;
    assert_eq!(std::fs::read(out.join("pack/a.bin")).unwrap(), bytes(A, 1));
    assert_eq!(std::fs::read(out.join("pack/b.bin")).unwrap(), bytes(B, 2));
    let c = out.join("pack/c.bin");
    assert!(
        !c.exists()
            || std::fs::metadata(&c).unwrap().len() == 0
            || std::fs::read(&c).unwrap() != bytes(C, 3),
        "the file that was not selected is not downloaded"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn download_limit_pause_resume_and_remove() {
    if no_ipv6() {
        return;
    }
    let env = Env::new("limits");
    let (_seed, file, addr) = seeder(&env).await;
    let leech = engine(&env, "leech").await;
    leech.set_limits(0, 100_000);
    let out = env.dir("out");
    let t0 = Instant::now();
    let id = leech
        .add(Source::File(file), &out, None, vec![addr])
        .await
        .unwrap();
    until("some progress", || one(&leech).progress_bytes > 20_000).await;

    leech.pause(id).await.unwrap();
    until("paused", || one(&leech).state == TorrentState::Paused).await;
    let at_pause = one(&leech).progress_bytes;
    assert!(at_pause < TOTAL, "paused before the end");
    tokio::time::sleep(Duration::from_millis(500)).await;
    assert_eq!(
        one(&leech).progress_bytes,
        at_pause,
        "nothing downloads while paused"
    );

    leech.resume(id).await.unwrap();
    until("finished", || {
        matches!(
            one(&leech).state,
            TorrentState::Seeding | TorrentState::Done
        )
    })
    .await;
    assert!(
        t0.elapsed() >= Duration::from_secs(5),
        "1.2 MB at 100 KB/s (after a small burst) cannot take {:?}",
        t0.elapsed()
    );
    assert_eq!(std::fs::read(out.join("pack/a.bin")).unwrap(), bytes(A, 1));

    // Remove without data: the files stay. With data: they go.
    leech.remove(id, false).await.unwrap();
    assert!(leech.list().is_empty());
    assert!(out.join("pack/a.bin").exists());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn remove_with_data_deletes_the_files() {
    if no_ipv6() {
        return;
    }
    let env = Env::new("remove");
    let (_seed, file, addr) = seeder(&env).await;
    let leech = engine(&env, "leech").await;
    let out = env.dir("out");
    let id = leech
        .add(Source::File(file), &out, None, vec![addr])
        .await
        .unwrap();
    until("finished", || {
        matches!(
            one(&leech).state,
            TorrentState::Seeding | TorrentState::Done
        )
    })
    .await;
    leech.remove(id, true).await.unwrap();
    assert!(leech.list().is_empty());
    assert!(
        !out.join("pack/a.bin").exists(),
        "files are deleted with the torrent"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn seeding_stops_at_the_ratio_and_a_restart_comes_back_paused() {
    if no_ipv6() {
        return;
    }
    let env = Env::new("seedlimit");
    let (seed, file, addr) = seeder(&env).await;
    seed.set_seed_limits(SeedLimits {
        ratio: Some(0.5),
        time: None,
    });
    let leech = engine(&env, "leech").await;
    leech
        .add(Source::File(file), &env.dir("out"), None, vec![addr])
        .await
        .unwrap();
    until("seeder reached its ratio and stopped", || {
        seed.list()
            .first()
            .is_some_and(|t| t.state == TorrentState::Done)
    })
    .await;
    assert!(one(&seed).ratio >= 0.5);

    // A restart: the saved list is back, nothing runs.
    leech.stop().await;
    drop(leech);
    let again = engine(&env, "leech").await;
    until("restored", || !again.list().is_empty()).await;
    until("restored as paused", || {
        one(&again).state == TorrentState::Paused
    })
    .await;
    // And it stays that way: nothing starts by itself.
    tokio::time::sleep(Duration::from_secs(2)).await;
    assert_eq!(one(&again).state, TorrentState::Paused);
    assert_eq!(one(&again).down_bps, 0);
}

#[tokio::test]
async fn only_magnets_and_torrent_files_are_accepted() {
    if no_ipv6() {
        return;
    }
    let env = Env::new("input");
    let e = engine(&env, "x").await;
    let dir = env.dir("out");
    for bad in ["https://example.org/a.torrent", "ftp://x", "hello"] {
        assert!(
            e.add(Source::Magnet(bad.into()), &dir, None, vec![])
                .await
                .is_err(),
            "{bad}"
        );
    }
    assert!(e
        .add(Source::File(vec![]), &dir, None, vec![])
        .await
        .is_err());
    assert!(e
        .add(Source::File(vec![0; 11 * 1024 * 1024]), &dir, None, vec![])
        .await
        .is_err());
    assert!(e
        .add(Source::File(b"not a torrent".to_vec()), &dir, None, vec![])
        .await
        .is_err());
    assert!(e
        .add(Source::File(vec![1]), Path::new("relative"), None, vec![])
        .await
        .is_err());
}
