use std::{
    collections::{HashMap, HashSet},
    net::SocketAddr,
    num::NonZeroU32,
    path::{Path, PathBuf},
    sync::{Arc, Mutex, MutexGuard},
    time::{Duration, Instant},
};

use anyhow::{anyhow, bail, Context, Result};
use librqbit::{
    api::TorrentIdOrHash, AddTorrent, AddTorrentOptions, AddTorrentResponse, ListOnlyResponse,
    ListenerOptions, Magnet, ManagedTorrent, Session, SessionOptions, SessionPersistenceConfig,
    TorrentStatsState,
};

use crate::{
    seed::SeedLimits,
    types::{FileEntry, Preview, Source, TorrentInfo, TorrentState},
};

/// Size cap for a `.torrent` file the user opens.
pub const MAX_TORRENT_FILE: usize = 10 * 1024 * 1024;
/// Most previews kept for a quick add (DL7: the cache is not unbounded).
const MAX_PREVIEWS: usize = 16;

pub struct EngineConfig {
    /// Where the engine keeps its own state (list of torrents, DHT table).
    pub state_dir: PathBuf,
    /// Default target folder (each torrent gets the folder the user chose when adding).
    pub default_dir: PathBuf,
    /// Distributed hash table: needed to find peers for a magnet link without a tracker.
    pub dht: bool,
    pub trackers: bool,
    /// `None` = a free port in the default range; tests use `127.0.0.1:0`.
    pub listen: Option<SocketAddr>,
    /// Open the listen port on the router (UPnP). Off unless the user asks.
    pub upnp: bool,
    /// IPv4 only (no dual-stack sockets); for machines without IPv6 and for tests.
    pub ipv4_only: bool,
}

pub struct Engine {
    session: Arc<Session>,
    seed: Arc<Mutex<SeedLimits>>,
    /// When each torrent was first seen complete (for the seeding time limit).
    finished_at: Arc<Mutex<HashMap<usize, Instant>>>,
    /// Torrents the seed limit stopped (shown as "done", not "paused").
    limit_stopped: Arc<Mutex<HashSet<usize>>>,
    /// Torrents the user resumed after the limit stopped them: the limit leaves them alone.
    exempt: Arc<Mutex<HashSet<usize>>>,
    /// `.torrent` bytes of every previewed torrent by info hash: adding a magnet link that was just
    /// previewed needs no second metadata fetch.
    previews: Arc<Mutex<HashMap<String, Vec<u8>>>>,
    /// Most bytes uploaded per torrent that we have seen (the engine's own counter restarts at zero when a
    /// torrent is paused, which would turn a stopped torrent's ratio into 0).
    uploaded: Arc<Mutex<HashMap<usize, u64>>>,
    /// Info hashes whose files got the Mark-of-the-Web (kept in `marked.json`), so a file the user
    /// unblocked is not marked again after a restart.
    marked: Arc<Mutex<Marked>>,
}

/// The set behind [`Engine::marked`] and where it is kept.
struct Marked {
    file: PathBuf,
    hashes: HashSet<String>,
}

impl Marked {
    fn open(state_dir: &Path) -> Marked {
        let file = state_dir.join("marked.json");
        let hashes = std::fs::read(&file)
            .ok()
            .and_then(|b| serde_json::from_slice(&b).ok())
            .unwrap_or_default();
        Marked { file, hashes }
    }

    fn contains(&self, key: &str) -> bool {
        self.hashes.contains(key)
    }

    /// Records a key (after its files were marked) and keeps the set on disk.
    fn insert(&mut self, key: String) {
        if self.hashes.insert(key) {
            if let Ok(json) = serde_json::to_vec(&self.hashes) {
                let _ = std::fs::write(&self.file, json);
            }
        }
    }
}

fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

fn nz(bps: u64) -> Option<NonZeroU32> {
    NonZeroU32::new(bps.min(u32::MAX as u64) as u32)
}

fn add_source(source: Source) -> Result<AddTorrent<'static>> {
    match source {
        Source::Magnet(m) => {
            let m = m.trim().to_string();
            if !m.starts_with("magnet:?") {
                bail!("not-a-magnet");
            }
            Ok(AddTorrent::Url(public_trackers_only(&m)?.into()))
        }
        Source::File(bytes) => {
            if bytes.is_empty() || bytes.len() > MAX_TORRENT_FILE {
                bail!("torrent-file-size");
            }
            Ok(AddTorrent::TorrentFileBytes(bytes.into()))
        }
    }
}

impl Engine {
    /// Starts the engine. Torrents saved by an earlier run are paused right away.
    pub async fn start(config: EngineConfig) -> Result<Engine> {
        std::fs::create_dir_all(&config.state_dir).context("state-dir")?;
        mark_saved_torrents_paused(&config.state_dir);
        let mut opts = SessionOptions {
            disable_trackers: !config.trackers,
            ipv4_only: config.ipv4_only,
            fastresume: true,
            persistence: Some(SessionPersistenceConfig::Json {
                folder: Some(config.state_dir.clone()),
            }),
            ..Default::default()
        };
        if !config.dht {
            opts.dht = None;
        }
        opts.listen = Some(ListenerOptions {
            listen_addr: config
                .listen
                .unwrap_or_else(|| (std::net::Ipv4Addr::UNSPECIFIED, 0).into()),
            enable_upnp_port_forwarding: config.upnp,
            ipv4_only: config.ipv4_only,
            ..Default::default()
        });
        let session = Session::new_with_opts(config.default_dir.clone(), opts)
            .await
            .context("session")?;
        let engine = Engine {
            session,
            seed: Arc::new(Mutex::new(SeedLimits::default())),
            finished_at: Arc::default(),
            limit_stopped: Arc::default(),
            exempt: Arc::default(),
            previews: Arc::default(),
            uploaded: Arc::default(),
            marked: Arc::new(Mutex::new(Marked::open(&config.state_dir))),
        };
        engine.spawn_seed_watcher();
        Ok(engine)
    }

    fn handles(&self) -> Vec<(usize, Arc<ManagedTorrent>)> {
        self.session
            .with_torrents(|it| it.map(|(id, h)| (id, h.clone())).collect())
    }

    fn handle(&self, id: usize) -> Result<Arc<ManagedTorrent>> {
        self.session
            .get(TorrentIdOrHash::Id(id))
            .ok_or_else(|| anyhow!("not-found"))
    }

    /// The address the engine accepts connections on (for tests and diagnostics).
    pub fn listen_addr(&self) -> Option<SocketAddr> {
        self.session.listen_addr()
    }

    async fn list_only(&self, source: Source, peers: Vec<SocketAddr>) -> Result<ListOnlyResponse> {
        let res = self
            .session
            .add_torrent(
                add_source(source)?,
                Some(AddTorrentOptions {
                    list_only: true,
                    initial_peers: (!peers.is_empty()).then_some(peers),
                    ..Default::default()
                }),
            )
            .await?;
        match res {
            AddTorrentResponse::ListOnly(info) => {
                // checked before anything is written: names librqbit would take as they are (DL1, DL8)
                // and trackers it would contact once the torrent is added (DL5)
                if !paths_safe(&info.info) {
                    bail!("bad-path");
                }
                if !trackers_public(&info.torrent_bytes) {
                    bail!("tracker");
                }
                Ok(info)
            }
            _ => bail!("already-added"),
        }
    }

    /// File list of what the user handed over. A magnet link has to fetch it from peers first, which can
    /// take a while (the caller applies a timeout). Nothing is added.
    pub async fn preview(&self, source: Source, peers: Vec<SocketAddr>) -> Result<Preview> {
        let info = self.list_only(source, peers).await?;
        let files: Vec<FileEntry> = info
            .info
            .iter_file_details()
            .enumerate()
            .map(|(index, d)| FileEntry {
                index,
                path: d.filename.to_string(),
                size: d.len,
            })
            .collect();
        let hash = info.info_hash.as_string();
        {
            let mut previews = lock(&self.previews);
            if previews.len() >= MAX_PREVIEWS {
                previews.clear();
            }
            previews.insert(hash.clone(), info.torrent_bytes.to_vec());
        }
        Ok(Preview {
            info_hash: hash,
            name: info.info.name().map(|n| n.into_owned()).unwrap_or_default(),
            total: files.iter().map(|f| f.size).sum(),
            files,
        })
    }

    /// Adds the torrent below `dir`, always in a folder of its own that did not exist before
    /// (`dir/<name>`, `dir/<name> (2)` …; a single file's folder is its name without the
    /// extension): nothing the user already had is ever overwritten (DL1), and the engine's
    /// `overwrite` only lets a torrent of ours continue its own files after a restart.
    /// `files` = the indices to download (`None` = everything).
    pub async fn add(
        &self,
        source: Source,
        dir: &Path,
        files: Option<Vec<usize>>,
        peers: Vec<SocketAddr>,
    ) -> Result<usize> {
        if !dir.is_absolute() || !dir.is_dir() {
            bail!("dir");
        }
        // A magnet link that was just previewed is added from the saved metadata.
        let cached = match &source {
            Source::Magnet(m) => Magnet::parse(m.trim())
                .ok()
                .and_then(|m| m.as_id20())
                .and_then(|h| lock(&self.previews).get(&h.as_string()).cloned()),
            Source::File(_) => None,
        };
        let source = match cached {
            Some(bytes) => Source::File(bytes),
            None => source,
        };
        let info = self.list_only(source.clone(), peers.clone()).await?;
        // shortcut files (`Besuche uns.url`, `desktop.ini` …) are never written: Explorer would
        // resolve them on sight (DL8); the rest of the torrent is fine
        let files = without_shortcuts(&info.info, files);
        if files.as_ref().is_some_and(|f| f.is_empty()) {
            bail!("bad-path");
        }
        let raw = info.info.name().map(|n| n.into_owned()).unwrap_or_default();
        let single = info.info.iter_file_details().count() == 1;
        let target = new_folder(dir, &folder_name(&raw, single))?;
        let add = match source {
            Source::File(b) => AddTorrent::TorrentFileBytes(b.into()),
            Source::Magnet(_) => AddTorrent::TorrentFileBytes(info.torrent_bytes.clone()),
        };
        let res = self
            .session
            .add_torrent(
                add,
                Some(AddTorrentOptions {
                    output_folder: Some(target.to_string_lossy().into_owned()),
                    only_files: files,
                    overwrite: true,
                    initial_peers: (!peers.is_empty()).then_some(peers),
                    ..Default::default()
                }),
            )
            .await;
        let res = match res {
            Ok(r) => r,
            Err(e) => {
                // nothing was added: the new folder is still empty
                let _ = std::fs::remove_dir(&target);
                return Err(e);
            }
        };
        match res {
            AddTorrentResponse::Added(id, _) => Ok(id),
            AddTorrentResponse::AlreadyManaged(id, _) => {
                // it keeps its own folder: the new one is still empty
                let _ = std::fs::remove_dir(&target);
                Ok(id)
            }
            AddTorrentResponse::ListOnly(_) => bail!("internal"),
        }
    }

    /// Tests only: adds a torrent whose files are already in `dir` (the seeder of the engine
    /// tests). The app always goes through [`Engine::add`] and its new folder.
    #[cfg(test)]
    pub(crate) async fn seed_from(&self, source: Source, dir: &Path) -> Result<usize> {
        let add = match add_source(source)? {
            AddTorrent::TorrentFileBytes(b) => AddTorrent::TorrentFileBytes(b),
            _ => bail!("file only"),
        };
        let res = self
            .session
            .add_torrent(
                add,
                Some(AddTorrentOptions {
                    output_folder: Some(dir.join("pack").to_string_lossy().into_owned()),
                    overwrite: true,
                    ..Default::default()
                }),
            )
            .await?;
        match res {
            AddTorrentResponse::Added(id, _) => Ok(id),
            _ => bail!("not added"),
        }
    }

    pub fn list(&self) -> Vec<TorrentInfo> {
        let stopped = lock(&self.limit_stopped).clone();
        let uploaded = lock(&self.uploaded).clone();
        let mut out: Vec<TorrentInfo> = self
            .handles()
            .into_iter()
            .map(|(id, h)| {
                info_of(
                    id,
                    &h,
                    stopped.contains(&id),
                    uploaded.get(&id).copied().unwrap_or(0),
                )
            })
            .collect();
        out.sort_by_key(|t| t.id);
        out
    }

    pub async fn pause(&self, id: usize) -> Result<()> {
        let h = self.handle(id)?;
        self.session.pause(&h).await
    }

    pub async fn resume(&self, id: usize) -> Result<()> {
        let h = self.handle(id)?;
        if lock(&self.limit_stopped).remove(&id) {
            lock(&self.exempt).insert(id);
        }
        self.session.unpause(&h).await
    }

    /// Removes the torrent; `delete_data` also deletes the downloaded files.
    pub async fn remove(&self, id: usize, delete_data: bool) -> Result<()> {
        lock(&self.finished_at).remove(&id);
        lock(&self.limit_stopped).remove(&id);
        lock(&self.exempt).remove(&id);
        lock(&self.uploaded).remove(&id);
        self.session
            .delete(TorrentIdOrHash::Id(id), delete_data)
            .await
    }

    /// Speed limits for all torrents together, bytes per second; 0 = none.
    pub fn set_limits(&self, upload_bps: u64, download_bps: u64) {
        self.session.ratelimits.set_upload_bps(nz(upload_bps));
        self.session.ratelimits.set_download_bps(nz(download_bps));
    }

    pub fn set_seed_limits(&self, limits: SeedLimits) {
        *lock(&self.seed) = limits;
    }

    pub async fn stop(&self) {
        self.session.stop().await;
    }

    /// Every few seconds: stop finished torrents that have seeded enough.
    fn spawn_seed_watcher(&self) {
        let session = self.session.clone();
        let seed = self.seed.clone();
        let finished_at = self.finished_at.clone();
        let limit_stopped = self.limit_stopped.clone();
        let exempt = self.exempt.clone();
        let uploaded = self.uploaded.clone();
        let marked = self.marked.clone();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(2)).await;
                let limits = *lock(&seed);
                let handles: Vec<(usize, Arc<ManagedTorrent>)> =
                    session.with_torrents(|it| it.map(|(id, h)| (id, h.clone())).collect());
                for (id, h) in handles {
                    let stats = h.stats();
                    {
                        let mut seen = lock(&uploaded);
                        let most = seen.entry(id).or_insert(0);
                        *most = (*most).max(stats.uploaded_bytes);
                    }
                    if !stats.finished || matches!(stats.state, TorrentStatsState::Paused) {
                        continue;
                    }
                    let since = *lock(&finished_at).entry(id).or_insert_with(Instant::now);
                    // the torrent's own files (never the rest of its folder), once per torrent, folder
                    // and selection (a re-download or a wider selection is marked again) (DL3)
                    let key = mark_key(&h);
                    if cfg!(windows) && !lock(&marked).contains(&key) {
                        let files = own_files(&h);
                        let marked = marked.clone();
                        tokio::task::spawn_blocking(move || {
                            let ok = files
                                .iter()
                                .all(|f| file_names::mark_of_the_web(f, None).is_ok());
                            // a failure is tried again on the next pass
                            if ok {
                                lock(&marked).insert(key);
                            }
                        });
                    }
                    if lock(&exempt).contains(&id) {
                        continue;
                    }
                    let up = lock(&uploaded).get(&id).copied().unwrap_or(0);
                    if limits.reached(up, stats.total_bytes, since.elapsed())
                        && session.pause(&h).await.is_ok()
                    {
                        lock(&limit_stopped).insert(id);
                    }
                }
            }
        });
    }
}

fn info_of(
    id: usize,
    h: &Arc<ManagedTorrent>,
    limit_stopped: bool,
    uploaded_seen: u64,
) -> TorrentInfo {
    let stats = h.stats();
    let uploaded = stats.uploaded_bytes.max(uploaded_seen);
    let (down, up, peers) = stats
        .live
        .as_ref()
        .map(|l| {
            (
                l.download_speed.as_bytes(),
                l.upload_speed.as_bytes(),
                l.snapshot.peer_stats.live,
            )
        })
        .unwrap_or_default();
    let state = match stats.state {
        TorrentStatsState::Error => TorrentState::Error,
        TorrentStatsState::Initializing { paused: true } => TorrentState::Paused,
        TorrentStatsState::Initializing { paused: false } => TorrentState::Starting,
        TorrentStatsState::Paused if stats.finished && limit_stopped => TorrentState::Done,
        TorrentStatsState::Paused => TorrentState::Paused,
        TorrentStatsState::Live if stats.finished => TorrentState::Seeding,
        TorrentStatsState::Live => TorrentState::Downloading,
    };
    TorrentInfo {
        id,
        info_hash: h.info_hash().as_string(),
        name: h.name().unwrap_or_default(),
        dir: h.output_folder().to_string_lossy().into_owned(),
        state,
        progress_bytes: stats.progress_bytes,
        total_bytes: stats.total_bytes,
        uploaded_bytes: uploaded,
        down_bps: down,
        up_bps: up,
        peers,
        ratio: if stats.total_bytes > 0 {
            uploaded as f64 / stats.total_bytes as f64
        } else {
            0.0
        },
        error: stats.error,
    }
}

/// Torrents saved by an earlier run must not start by themselves, also not after a crash: before the
/// engine reads its saved list, every entry in it is marked paused (it then only checks its files).
fn mark_saved_torrents_paused(state_dir: &Path) {
    let file = state_dir.join("session.json");
    let Ok(raw) = std::fs::read(&file) else {
        return;
    };
    let Ok(mut db) = serde_json::from_slice::<serde_json::Value>(&raw) else {
        return;
    };
    let mut changed = false;
    if let Some(torrents) = db.get_mut("torrents").and_then(|t| t.as_object_mut()) {
        for t in torrents.values_mut() {
            if let Some(entry) = t.as_object_mut() {
                if entry.get("is_paused") != Some(&serde_json::Value::Bool(true)) {
                    entry.insert("is_paused".into(), serde_json::Value::Bool(true));
                    changed = true;
                }
            }
        }
    }
    if changed {
        if let Ok(out) = serde_json::to_vec(&db) {
            let tmp = file.with_extension("json.tmp");
            if std::fs::write(&tmp, out).is_ok() {
                let _ = std::fs::rename(&tmp, &file);
            }
        }
    }
}

/// What [`Marked`] remembers: info hash, output folder and the selection.
fn mark_key(h: &Arc<ManagedTorrent>) -> String {
    let only = h
        .only_files()
        .map(|o| o.iter().map(|i| i.to_string()).collect::<Vec<_>>().join(","))
        .unwrap_or_default();
    format!(
        "{}|{}|{only}",
        h.info_hash().as_string(),
        h.output_folder().display()
    )
}

/// The files a torrent wrote: its output folder joined with each selected file's path (no
/// padding files). Only plain relative paths (no `..`, no root) are returned.
fn own_files(h: &Arc<ManagedTorrent>) -> Vec<PathBuf> {
    let out = h.output_folder().to_path_buf();
    let only = h.only_files();
    h.with_metadata(|m| {
        m.file_infos
            .iter()
            .enumerate()
            .filter(|(i, f)| !f.attrs.padding && only.as_ref().is_none_or(|o| o.contains(i)))
            .filter(|(_, f)| {
                f.relative_filename
                    .components()
                    .all(|c| matches!(c, std::path::Component::Normal(_)))
            })
            .map(|(_, f)| out.join(&f.relative_filename))
            .collect()
    })
    .unwrap_or_default()
}

/// A torrent name as a single safe folder name (the shared cleaner, DL8); a single file's folder
/// drops the extension (`ubuntu.iso` → `ubuntu`).
fn folder_name(name: &str, single: bool) -> String {
    let cleaned = file_names::clean(if name.trim().is_empty() { "torrent" } else { name });
    match (single, cleaned.rfind('.')) {
        (true, Some(dot)) if dot > 0 => file_names::clean(&cleaned[..dot]),
        _ => cleaned,
    }
}

/// Creates the first of `name`, `name (2)` … that does not exist yet in `dir` (create-new, so a
/// race never reuses a folder) and returns it.
fn new_folder(dir: &Path, name: &str) -> Result<PathBuf> {
    for candidate in file_names::candidates(name) {
        let path = dir.join(&candidate);
        match std::fs::create_dir(&path) {
            Ok(()) => return Ok(path),
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(_) => bail!("dir"),
        }
    }
    bail!("dir")
}

/// Every path inside the torrent is made of plain names librqbit can take as they are: no drive
/// letter or stream (`C:x`, `a:b`), no device name, no invisible or bidi character, no `.`/`..`.
/// librqbit itself refuses only `..` and separators (security review 2026-11, package 3).
fn paths_safe<B: AsRef<[u8]>>(info: &librqbit::ValidatedTorrentMetaV1Info<B>) -> bool {
    info.iter_file_details()
        .all(|d| d.filename.to_vec().iter().all(|c| file_names::safe_segment(c)))
}

/// The selection without files whose name is a shortcut type; `None` (everything) stays `None`
/// when the torrent has none.
fn without_shortcuts<B: AsRef<[u8]>>(
    info: &librqbit::ValidatedTorrentMetaV1Info<B>,
    files: Option<Vec<usize>>,
) -> Option<Vec<usize>> {
    let shortcut: Vec<bool> = info
        .iter_file_details()
        .map(|d| d.filename.to_vec().last().is_some_and(|n| file_names::shortcut(n)))
        .collect();
    if files.is_none() && !shortcut.contains(&true) {
        return None;
    }
    let wanted = files.unwrap_or_else(|| (0..shortcut.len()).collect());
    Some(
        wanted
            .into_iter()
            .filter(|i| !shortcut.get(*i).copied().unwrap_or(true))
            .collect(),
    )
}

/// A tracker address librqbit may contact: `http`, `https` or `udp` to a host that is not this PC
/// or the home network (an IP of it, `localhost`). A host name is not looked up here.
fn tracker_allowed(raw: &str) -> bool {
    let Ok(url) = url::Url::parse(raw.trim()) else {
        return false;
    };
    if !matches!(url.scheme(), "http" | "https" | "udp") {
        return false;
    }
    match url.host() {
        Some(url::Host::Ipv4(ip)) => downloader::net::is_public_ip(ip.into()),
        Some(url::Host::Ipv6(ip)) => downloader::net::is_public_ip(ip.into()),
        // `udp:` is no special scheme for `url`: its hosts come as names, and the system resolver
        // reads `127.1`, `2130706433` or `0x7f.0.0.1` as IPs. Parsed the way an `http` host is,
        // every such spelling becomes the IP it means.
        Some(url::Host::Domain(d)) => match url::Url::parse(&format!("http://{d}/")) {
            Ok(as_http) => match as_http.host() {
                Some(url::Host::Ipv4(ip)) => downloader::net::is_public_ip(ip.into()),
                Some(url::Host::Ipv6(ip)) => downloader::net::is_public_ip(ip.into()),
                Some(url::Host::Domain(name)) => {
                    let name = name.trim_end_matches('.').to_ascii_lowercase();
                    !(name == "localhost" || name.ends_with(".localhost"))
                }
                None => false,
            },
            Err(_) => false,
        },
        None => false,
    }
}

/// The magnet link without its trackers that are not allowed (the preview contacts the rest).
fn public_trackers_only(magnet: &str) -> Result<String> {
    let parsed = url::Url::parse(magnet).map_err(|_| anyhow!("not-a-magnet"))?;
    let kept: Vec<(String, String)> = parsed
        .query_pairs()
        .filter(|(k, v)| k != "tr" || tracker_allowed(v))
        .map(|(k, v)| (k.into_owned(), v.into_owned()))
        .collect();
    let query = url::form_urlencoded::Serializer::new(String::new())
        .extend_pairs(kept)
        .finish();
    Ok(format!("magnet:?{query}"))
}

/// Whether every tracker a `.torrent` names is allowed. A torrent file cannot be rewritten without
/// changing what it is, so one with a tracker in the home network is refused as a whole (DL5).
fn trackers_public(torrent_bytes: &[u8]) -> bool {
    let Ok(meta) = librqbit::torrent_from_bytes(torrent_bytes) else {
        return false;
    };
    let all_allowed = meta
        .iter_announce()
        .all(|t| std::str::from_utf8(t.as_ref()).is_ok_and(tracker_allowed));
    all_allowed
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn folder_names_are_single_safe_segments() {
        assert_eq!(folder_name("Linux ISO 12", false), "Linux ISO 12");
        assert_eq!(folder_name("../../etc", false), "etc");
        assert_eq!(folder_name("a/b\\c:d", false), "c_d");
        assert_eq!(folder_name("..", false), "Datei");
        assert_eq!(folder_name("", false), "torrent");
        assert_eq!(folder_name("CON", false), "_CON");
        assert_eq!(folder_name("ubuntu-24.04.iso", true), "ubuntu-24.04");
        assert!(folder_name(&"x".repeat(500), false).len() <= file_names::MAX_NAME_BYTES);
    }

    /// DL1: an existing folder (and so its files) is never used again.
    #[test]
    fn each_torrent_gets_a_folder_that_did_not_exist() {
        let dir = std::env::temp_dir().join(format!("tt-new-folder-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("pack")).unwrap();
        std::fs::write(dir.join("pack").join("a.bin"), b"mine").unwrap();
        let first = new_folder(&dir, "pack").unwrap();
        assert_eq!(first, dir.join("pack (2)"));
        assert_eq!(new_folder(&dir, "pack").unwrap(), dir.join("pack (3)"));
        assert_eq!(std::fs::read(dir.join("pack").join("a.bin")).unwrap(), b"mine");
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// DL3: a torrent's files are marked once; after a restart an unblocked file stays unblocked.
    #[test]
    fn each_torrent_is_marked_once_across_restarts() {
        let dir = std::env::temp_dir().join(format!("tt-marked-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let mut marked = Marked::open(&dir);
        assert!(!marked.contains("abc|/x|"));
        marked.insert("abc|/x|".into());
        assert!(Marked::open(&dir).contains("abc|/x|"), "kept on disk");
        // the same torrent in a new folder (removed and added again) is a new key
        assert!(!Marked::open(&dir).contains("abc|/x (2)|"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// DL8: a shortcut file in a torrent is left out, the rest downloads.
    #[tokio::test]
    async fn shortcut_files_are_left_out_of_the_selection() {
        let t = torrent_with(&["film.mkv", "Besuche uns.url", "desktop.ini"], None).await;
        let meta = librqbit::torrent_from_bytes(&t).unwrap();
        let info = meta.info.data.validate().unwrap();
        let names: Vec<String> = info
            .iter_file_details()
            .map(|d| d.filename.to_vec().join("/"))
            .collect();
        let film = names.iter().position(|n| n == "film.mkv").unwrap();
        assert_eq!(without_shortcuts(&info, None), Some(vec![film]));
        assert_eq!(without_shortcuts(&info, Some(vec![film])), Some(vec![film]));
        let plain = torrent_with(&["a.bin", "b.bin"], None).await;
        let meta = librqbit::torrent_from_bytes(&plain).unwrap();
        assert_eq!(without_shortcuts(&meta.info.data.validate().unwrap(), None), None);
    }

    #[test]
    fn trackers_in_the_home_network_are_not_contacted() {
        assert!(tracker_allowed("udp://tracker.example.org:6969/announce"));
        assert!(tracker_allowed("https://tracker.example.org/announce"));
        for bad in [
            "http://192.168.178.1/announce",
            "udp://127.0.0.1:6969",
            "udp://127.1:6969",
            "udp://2130706433:6969",
            "udp://0x7f.0.0.1:6969",
            "udp://[::1]:6969",
            "http://localhost:8080/a",
            "http://[fe80::1]/a",
            "file:///etc/passwd",
            "wss://tracker.example.org",
            "not a url",
        ] {
            assert!(!tracker_allowed(bad), "{bad}");
        }
        let magnet = "magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=x\
            &tr=udp%3A%2F%2Ftracker.example.org%3A6969&tr=http%3A%2F%2F192.168.0.1%2Fannounce";
        let kept = public_trackers_only(magnet).unwrap();
        assert!(kept.contains("tracker.example.org"));
        assert!(!kept.contains("192.168"));
        assert!(kept.contains("xt=urn%3Abtih%3A0123456789abcdef0123456789abcdef01234567"));
    }

    async fn torrent_with(names: &[&str], announce: Option<&str>) -> Vec<u8> {
        static NEXT: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
        let n = NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!("tt-meta-{}-{n}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let pack = dir.join("pack");
        std::fs::create_dir_all(&pack).unwrap();
        for n in names {
            std::fs::write(pack.join(n), b"data").unwrap();
        }
        let options = librqbit::CreateTorrentOptions {
            piece_length: Some(16384),
            trackers: announce.map(|a| vec![a.to_owned()]).unwrap_or_default(),
            ..Default::default()
        };
        let t = librqbit::create_torrent(
            &pack,
            options,
            &librqbit::spawn_utils::BlockingSpawner::new(1),
        )
        .await
        .unwrap();
        let _ = std::fs::remove_dir_all(&dir);
        t.as_bytes().unwrap().to_vec()
    }

    /// librqbit takes `C:x`, `con.txt` and bidi names as they are: such a torrent is refused.
    #[tokio::test]
    async fn unsafe_paths_inside_a_torrent_are_refused() {
        let ok = torrent_with(&["a.bin", "b.bin"], None).await;
        let meta = librqbit::torrent_from_bytes(&ok).unwrap();
        assert!(paths_safe(&meta.info.data.validate().unwrap()));
        for bad in ["con.txt", "C:evil", "gnp.\u{202E}exe"] {
            let t = torrent_with(&["a.bin", bad], None).await;
            let meta = librqbit::torrent_from_bytes(&t).unwrap();
            assert!(!paths_safe(&meta.info.data.validate().unwrap()), "{bad:?}");
        }
    }

    #[tokio::test]
    async fn a_torrent_file_with_a_home_network_tracker_is_refused() {
        assert!(trackers_public(&torrent_with(&["a.bin"], None).await));
        let public = torrent_with(&["a.bin"], Some("udp://tracker.example.org:6969")).await;
        assert!(trackers_public(&public));
        let home = torrent_with(&["a.bin"], Some("http://192.168.1.1/announce")).await;
        assert!(!trackers_public(&home));
    }
}
