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
            Ok(AddTorrent::Url(m.into()))
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
            AddTorrentResponse::ListOnly(info) => Ok(info),
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
        lock(&self.previews).insert(hash.clone(), info.torrent_bytes.to_vec());
        Ok(Preview {
            info_hash: hash,
            name: info.info.name().map(|n| n.into_owned()).unwrap_or_default(),
            total: files.iter().map(|f| f.size).sum(),
            files,
        })
    }

    /// Adds the torrent below `dir`: a torrent with several files gets its own folder `dir/<name>`, a
    /// single file lands in `dir`. `files` = the indices to download (`None` = everything).
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
        let name = folder_name(&info.info.name().map(|n| n.into_owned()).unwrap_or_default());
        let multi = info.info.iter_file_details().count() > 1;
        let target = if multi {
            dir.join(name)
        } else {
            dir.to_path_buf()
        };
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
            .await?;
        match res {
            AddTorrentResponse::Added(id, _) | AddTorrentResponse::AlreadyManaged(id, _) => Ok(id),
            AddTorrentResponse::ListOnly(_) => bail!("internal"),
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

/// A torrent name as a single safe folder name: no separators, no `..`, no Windows-reserved characters.
fn folder_name(name: &str) -> String {
    let flat: String = name
        .chars()
        .map(|c| {
            if c.is_control() || matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') {
                '_'
            } else {
                c
            }
        })
        .collect();
    let trimmed = flat.trim_matches(|c| c == '.' || c == ' ');
    if trimmed.is_empty() {
        "torrent".into()
    } else {
        trimmed.chars().take(120).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::folder_name;

    #[test]
    fn folder_names_are_single_safe_segments() {
        assert_eq!(folder_name("Linux ISO 12"), "Linux ISO 12");
        assert_eq!(folder_name("../../etc"), "_.._etc");
        assert_eq!(folder_name("a/b\\c:d"), "a_b_c_d");
        assert_eq!(folder_name(".."), "torrent");
        assert_eq!(folder_name(""), "torrent");
        assert!(folder_name(&"x".repeat(500)).chars().count() <= 120);
    }
}
