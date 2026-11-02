//! Torrent part of the Downloads module (desktop only): thin wrapper around the `torrent` crate.
//! The webview hands over a magnet link or the path of a `.torrent` file it opened; nothing is
//! searched, nothing downloaded is opened or run. The engine starts on the first call (the module
//! only makes that call after the user switched the torrent part on and confirmed the notice).

use std::{
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};

use ::torrent::{Engine, EngineConfig, Preview, SeedLimits, Source, TorrentInfo};
use serde::Deserialize;
use tauri::{ipc::Channel, AppHandle, Manager as _, State};
use tokio::sync::Mutex;

/// A magnet link needs peers to tell us what is inside; give up after this long.
const PREVIEW_TIMEOUT: Duration = Duration::from_secs(90);

#[derive(Default)]
pub struct Torrents {
    engine: Mutex<Option<Arc<Engine>>>,
    watchers: Arc<std::sync::Mutex<Vec<Channel<Vec<TorrentInfo>>>>>,
    watching: std::sync::atomic::AtomicBool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TorrentSettings {
    /// Only read when the engine starts (a change needs "turn off, turn on").
    dht: bool,
    upnp: bool,
    /// KB/s, 0 = unlimited.
    upload_kb: u64,
    download_kb: u64,
    /// 0 = no limit.
    seed_ratio: f64,
    /// Minutes, 0 = no limit.
    seed_minutes: u64,
}

/// What the user handed over: a pasted magnet link, or the path of a `.torrent` file picked in the
/// system dialog.
#[derive(Deserialize)]
#[serde(tag = "kind", content = "value", rename_all = "camelCase")]
pub enum SourceIn {
    Magnet(String),
    File(String),
}

fn source(input: SourceIn) -> Result<Source, String> {
    match input {
        SourceIn::Magnet(m) => Ok(Source::Magnet(m)),
        SourceIn::File(path) => {
            let path = Path::new(&path);
            let is_torrent = path
                .extension()
                .is_some_and(|e| e.eq_ignore_ascii_case("torrent"));
            let meta = std::fs::metadata(path).map_err(|_| "file".to_string())?;
            if !is_torrent || !meta.is_file() || meta.len() > ::torrent::MAX_TORRENT_FILE as u64 {
                return Err("file".into());
            }
            std::fs::read(path)
                .map(Source::File)
                .map_err(|_| "file".to_string())
        }
    }
}

fn code(e: impl std::fmt::Display) -> String {
    // Short machine codes the page maps to texts; anything else is "other".
    let msg = e.to_string();
    for known in [
        "not-a-magnet",
        "torrent-file-size",
        "dir",
        "not-found",
        "already-added",
    ] {
        if msg == known {
            return msg;
        }
    }
    "other".into()
}

impl Torrents {
    async fn engine(&self) -> Result<Arc<Engine>, String> {
        self.engine
            .lock()
            .await
            .clone()
            .ok_or_else(|| "off".to_string())
    }
}

fn state_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let file = crate::downloads::state_file(app)?;
    Ok(file
        .parent()
        .map(|p| p.join("torrent-state"))
        .unwrap_or_else(|| PathBuf::from("torrent-state")))
}

/// Starts the engine if it is not running and applies the limits. Safe to call again with new limits.
#[tauri::command]
pub async fn torrent_configure(
    app: AppHandle,
    state: State<'_, Torrents>,
    settings: TorrentSettings,
) -> Result<(), String> {
    let mut slot = state.engine.lock().await;
    if slot.is_none() {
        let default_dir = app
            .path()
            .download_dir()
            .map_err(|_| "no-dir".to_string())?;
        let engine = Engine::start(EngineConfig {
            state_dir: state_dir(&app)?,
            default_dir,
            dht: settings.dht,
            trackers: true,
            listen: None,
            upnp: settings.upnp,
            ipv4_only: false,
        })
        .await
        .map_err(|_| "start".to_string())?;
        *slot = Some(Arc::new(engine));
    }
    let engine = slot.clone().ok_or("off")?;
    drop(slot);
    engine.set_limits(settings.upload_kb * 1024, settings.download_kb * 1024);
    engine.set_seed_limits(SeedLimits {
        ratio: (settings.seed_ratio > 0.0).then_some(settings.seed_ratio),
        time: (settings.seed_minutes > 0).then(|| Duration::from_secs(settings.seed_minutes * 60)),
    });
    Ok(())
}

/// Shuts the engine down (the torrent part was switched off). Saved torrents stay in the list.
#[tauri::command]
pub async fn torrent_stop(state: State<'_, Torrents>) -> Result<(), String> {
    let engine = state.engine.lock().await.take();
    if let Some(e) = engine {
        e.stop().await;
    }
    Ok(())
}

/// The file list of a magnet link / `.torrent` before anything is added.
#[tauri::command]
pub async fn torrent_preview(
    state: State<'_, Torrents>,
    input: SourceIn,
) -> Result<Preview, String> {
    let engine = state.engine().await?;
    let src = source(input)?;
    match tokio::time::timeout(PREVIEW_TIMEOUT, engine.preview(src, vec![])).await {
        Ok(r) => r.map_err(code),
        Err(_) => Err("timeout".into()),
    }
}

#[tauri::command]
pub async fn torrent_add(
    state: State<'_, Torrents>,
    input: SourceIn,
    dir: String,
    files: Option<Vec<usize>>,
) -> Result<usize, String> {
    let engine = state.engine().await?;
    let src = source(input)?;
    match tokio::time::timeout(
        PREVIEW_TIMEOUT,
        engine.add(src, &PathBuf::from(dir), files, vec![]),
    )
    .await
    {
        Ok(r) => r.map_err(code),
        Err(_) => Err("timeout".into()),
    }
}

#[tauri::command]
pub async fn torrent_pause(state: State<'_, Torrents>, id: usize) -> Result<(), String> {
    state.engine().await?.pause(id).await.map_err(code)
}

#[tauri::command]
pub async fn torrent_resume(state: State<'_, Torrents>, id: usize) -> Result<(), String> {
    state.engine().await?.resume(id).await.map_err(code)
}

#[tauri::command]
pub async fn torrent_remove(
    state: State<'_, Torrents>,
    id: usize,
    delete_data: bool,
) -> Result<(), String> {
    state
        .engine()
        .await?
        .remove(id, delete_data)
        .await
        .map_err(code)
}

/// The list now and about once a second while the page watches.
#[tauri::command]
pub async fn torrent_watch(
    state: State<'_, Torrents>,
    events: Channel<Vec<TorrentInfo>>,
) -> Result<(), String> {
    let engine = state.engine().await?;
    let _ = events.send(engine.list());
    state
        .watchers
        .lock()
        .map_err(|_| "internal".to_string())?
        .push(events);
    if !state
        .watching
        .swap(true, std::sync::atomic::Ordering::SeqCst)
    {
        let watchers = state.watchers.clone();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(1)).await;
                let list = engine.list();
                let Ok(mut w) = watchers.lock() else { break };
                w.retain(|c| c.send(list.clone()).is_ok());
            }
        });
    }
    Ok(())
}
