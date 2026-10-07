//! Built-in local language model (stage 1 of the AI entry pipeline, 0 tokens, desktop only).
//!
//! The model runs in this process (`crates/local-llm`, llama.cpp); nothing is sent anywhere. The only
//! network access is the model download the user confirmed in the settings: https from Hugging Face
//! only, size and SHA-256 are checked, a file that does not match is deleted. The webview passes file
//! names, never paths: models live in `<data folder>/models`.
//!
//! Without the `local-llm` cargo feature the commands exist but answer "build" (the app is built
//! without llama.cpp); the frontend then hides the feature.

// Helpers and event types are only used by the real implementation (and the tests) without the feature.
#![cfg_attr(not(feature = "local-llm"), allow(dead_code))]

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::AppHandle;

/// A model file on disk (verified: it has a `.sha256` sidecar written after the download check).
#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ModelFile {
    pub file: String,
    pub bytes: u64,
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DownloadSpec {
    pub file: String,
    pub url: String,
    pub sha256: String,
    pub bytes: u64,
}

/// What the webview may ask to download. Hosts of Hugging Face and its CDN only.
const HOSTS: &[&str] = &["huggingface.co", "hf.co"];
const MAX_BYTES: u64 = 20 * 1024 * 1024 * 1024;

pub fn valid_file_name(name: &str) -> bool {
    let stem = name.strip_suffix(".gguf");
    matches!(stem, Some(s) if !s.is_empty() && s.len() <= 120
        && s.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_')) && !s.starts_with('.'))
}

pub fn allowed_url(url: &str) -> bool {
    let Some(rest) = url.strip_prefix("https://") else {
        return false;
    };
    let host = rest.split(['/', '?', '#']).next().unwrap_or("");
    !host.contains('@')
        && !host.contains(':')
        && HOSTS
            .iter()
            .any(|h| host == *h || host.ends_with(&format!(".{h}")))
}

pub fn check_spec(spec: &DownloadSpec) -> Result<(), &'static str> {
    if !valid_file_name(&spec.file) {
        return Err("bad-file");
    }
    if !allowed_url(&spec.url) {
        return Err("bad-url");
    }
    if spec.sha256.len() != 64 || !spec.sha256.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("bad-checksum");
    }
    if spec.bytes == 0 || spec.bytes > MAX_BYTES {
        return Err("bad-size");
    }
    Ok(())
}

pub fn models_dir(app: &AppHandle) -> Option<PathBuf> {
    crate::capture::app_data_folder(app).map(|d| d.join("models"))
}

fn sidecar(file: &Path) -> PathBuf {
    let mut name = file
        .file_name()
        .map(|n| n.to_os_string())
        .unwrap_or_default();
    name.push(".sha256");
    file.with_file_name(name)
}

/// Verified model files in `dir`: `<name>.gguf` with a `<name>.gguf.sha256` sidecar.
pub fn list_models(dir: &Path) -> Vec<ModelFile> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut out: Vec<ModelFile> = entries
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().into_owned();
            let meta = e.metadata().ok()?;
            let verified = valid_file_name(&name) && meta.is_file() && sidecar(&e.path()).is_file();
            verified.then_some(ModelFile {
                file: name,
                bytes: meta.len(),
            })
        })
        .collect();
    out.sort_by(|a, b| a.file.cmp(&b.file));
    out
}

#[cfg(feature = "local-llm")]
mod real {
    use super::*;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::{Arc, Mutex};
    use tauri::ipc::Channel;
    use tauri::State;

    #[derive(Default)]
    pub struct LocalLlm {
        loaded: Mutex<Option<(String, Arc<local_llm::Worker>)>>,
        generating: Mutex<Option<Arc<AtomicBool>>>,
        downloading: Mutex<Option<Arc<AtomicBool>>>,
    }

    impl LocalLlm {
        pub fn new() -> Self {
            Self::default()
        }
    }

    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    pub struct Loaded {
        file: String,
        info: local_llm::ModelInfo,
    }

    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    pub struct Status {
        unavailable: Option<&'static str>,
        models: Vec<ModelFile>,
        loaded: Option<Loaded>,
        devices: Vec<local_llm::BackendDevice>,
        folder: Option<String>,
    }

    #[derive(Serialize, Clone)]
    #[serde(rename_all = "camelCase", tag = "event", content = "data")]
    pub enum ProgressEvent {
        Progress { done: u64, total: u64 },
    }

    #[derive(Serialize, Clone)]
    #[serde(rename_all = "camelCase", tag = "event", content = "data")]
    pub enum TokenEvent {
        Piece { text: String },
    }

    fn dir(app: &AppHandle) -> Result<PathBuf, String> {
        models_dir(app).ok_or_else(|| "no-data-dir".to_owned())
    }

    #[tauri::command]
    pub async fn llm_status(app: AppHandle, state: State<'_, LocalLlm>) -> Result<Status, String> {
        let supported = local_llm::cpu_supported();
        let devices = if supported {
            tauri::async_runtime::spawn_blocking(local_llm::backend_devices)
                .await
                .map_err(|_| "internal".to_owned())?
        } else {
            Vec::new()
        };
        let folder = models_dir(&app);
        let loaded = state
            .loaded
            .lock()
            .map_err(|_| "internal")?
            .as_ref()
            .map(|(file, w)| Loaded {
                file: file.clone(),
                info: w.info.clone(),
            });
        Ok(Status {
            unavailable: (!supported).then_some("cpu"),
            models: folder.as_deref().map(list_models).unwrap_or_default(),
            loaded,
            devices,
            folder: folder.map(|d| d.display().to_string()),
        })
    }

    #[tauri::command]
    pub async fn llm_download(
        app: AppHandle,
        state: State<'_, LocalLlm>,
        spec: DownloadSpec,
        on_event: Channel<ProgressEvent>,
    ) -> Result<(), String> {
        check_spec(&spec).map_err(str::to_owned)?;
        let dest = dir(&app)?.join(&spec.file);
        let cancel = Arc::new(AtomicBool::new(false));
        {
            let mut slot = state.downloading.lock().map_err(|_| "internal")?;
            if slot.is_some() {
                return Err("busy".into());
            }
            *slot = Some(cancel.clone());
        }
        let result = tauri::async_runtime::spawn_blocking({
            let spec = spec.clone();
            let dest = dest.clone();
            move || {
                let mut last = 0u64;
                local_llm::download_verified(
                    &spec.url,
                    &dest,
                    &spec.sha256,
                    spec.bytes,
                    &cancel,
                    |p| {
                        // About one event per MiB keeps the IPC quiet.
                        if p.done == p.total
                            || p.done.saturating_sub(last) >= 1 << 20
                            || p.done == 0
                        {
                            last = p.done;
                            let _ = on_event.send(ProgressEvent::Progress {
                                done: p.done,
                                total: p.total,
                            });
                        }
                    },
                )
            }
        })
        .await;
        *state.downloading.lock().map_err(|_| "internal")? = None;
        match result.map_err(|_| "internal".to_owned())? {
            Ok(()) => std::fs::write(sidecar(&dest), spec.sha256.to_lowercase())
                .map_err(|_| "io".to_owned()),
            Err(local_llm::DownloadError::Cancelled) => Err("cancelled".into()),
            Err(local_llm::DownloadError::ChecksumMismatch { .. }) => Err("checksum".into()),
            Err(local_llm::DownloadError::SizeMismatch { .. }) => Err("size".into()),
            Err(local_llm::DownloadError::Http(_)) => Err("network".into()),
            Err(_) => Err("io".into()),
        }
    }

    #[tauri::command]
    pub fn llm_download_cancel(state: State<'_, LocalLlm>) {
        if let Ok(slot) = state.downloading.lock() {
            if let Some(flag) = slot.as_ref() {
                flag.store(true, Ordering::Relaxed);
            }
        }
    }

    #[tauri::command]
    pub async fn llm_remove(
        app: AppHandle,
        state: State<'_, LocalLlm>,
        file: String,
    ) -> Result<(), String> {
        if !valid_file_name(&file) {
            return Err("bad-file".into());
        }
        {
            let mut loaded = state.loaded.lock().map_err(|_| "internal")?;
            if loaded.as_ref().is_some_and(|(f, _)| *f == file) {
                *loaded = None; // drops the worker: the model is freed before the file goes
            }
        }
        let path = dir(&app)?.join(&file);
        let _ = std::fs::remove_file(sidecar(&path));
        let _ = std::fs::remove_file(path.with_file_name(format!("{file}.part")));
        match std::fs::remove_file(&path) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(_) => Err("io".into()),
        }
    }

    #[tauri::command]
    pub async fn llm_load(
        app: AppHandle,
        state: State<'_, LocalLlm>,
        file: String,
        gpu: bool,
        context: u32,
    ) -> Result<local_llm::ModelInfo, String> {
        if !valid_file_name(&file) {
            return Err("bad-file".into());
        }
        let path = dir(&app)?.join(&file);
        if !sidecar(&path).is_file() || !path.is_file() {
            return Err("not-downloaded".into());
        }
        *state.loaded.lock().map_err(|_| "internal")? = None; // free the old model first
        let worker = tauri::async_runtime::spawn_blocking(move || {
            let gpu_layers = if gpu && local_llm::backend_devices().iter().any(|d| d.gpu) {
                999
            } else {
                0
            };
            local_llm::Worker::spawn(
                &path,
                &local_llm::LoadParams {
                    gpu_layers,
                    context: context.clamp(1024, 16384),
                    threads: None,
                },
            )
        })
        .await
        .map_err(|_| "internal".to_owned())?
        .map_err(|e| e.to_string())?;
        let info = worker.info.clone();
        *state.loaded.lock().map_err(|_| "internal")? = Some((file, Arc::new(worker)));
        Ok(info)
    }

    #[tauri::command]
    pub async fn llm_unload(state: State<'_, LocalLlm>) -> Result<(), String> {
        llm_cancel(state.clone());
        let old = state.loaded.lock().map_err(|_| "internal")?.take();
        // Dropping joins the worker thread; keep that off the async runtime.
        tauri::async_runtime::spawn_blocking(move || drop(old))
            .await
            .map_err(|_| "internal".to_owned())
    }

    #[tauri::command]
    pub async fn llm_generate(
        state: State<'_, LocalLlm>,
        prompt: String,
        grammar: Option<String>,
        max_tokens: u32,
        on_token: Channel<TokenEvent>,
    ) -> Result<local_llm::GenerateResult, String> {
        let worker = state
            .loaded
            .lock()
            .map_err(|_| "internal")?
            .as_ref()
            .map(|(_, w)| w.clone())
            .ok_or_else(|| "not-loaded".to_owned())?;
        let cancel = Arc::new(AtomicBool::new(false));
        *state.generating.lock().map_err(|_| "internal")? = Some(cancel.clone());
        let request = local_llm::GenerateRequest {
            prompt,
            grammar,
            max_tokens: max_tokens.clamp(1, 2048),
        };
        let result = tauri::async_runtime::spawn_blocking(move || {
            worker.generate(request, cancel, move |piece| {
                on_token
                    .send(TokenEvent::Piece {
                        text: piece.to_owned(),
                    })
                    .is_ok()
            })
        })
        .await
        .map_err(|_| "internal".to_owned())?;
        *state.generating.lock().map_err(|_| "internal")? = None;
        result.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn llm_cancel(state: State<'_, LocalLlm>) {
        if let Ok(slot) = state.generating.lock() {
            if let Some(flag) = slot.as_ref() {
                flag.store(true, Ordering::Relaxed);
            }
        }
    }
}

#[cfg(not(feature = "local-llm"))]
mod real {
    use super::*;
    use tauri::ipc::Channel;

    /// State of the stub: nothing to hold.
    pub struct LocalLlm;

    impl LocalLlm {
        pub fn new() -> Self {
            Self
        }
    }

    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    pub struct Status {
        unavailable: Option<&'static str>,
        models: Vec<ModelFile>,
        loaded: Option<()>,
        devices: Vec<()>,
        folder: Option<String>,
    }

    #[derive(Serialize, Clone)]
    #[serde(rename_all = "camelCase", tag = "event", content = "data")]
    pub enum ProgressEvent {
        Progress { done: u64, total: u64 },
    }

    #[derive(Serialize, Clone)]
    #[serde(rename_all = "camelCase", tag = "event", content = "data")]
    pub enum TokenEvent {
        Piece { text: String },
    }

    const BUILD: &str = "build";

    #[tauri::command]
    pub async fn llm_status(app: AppHandle) -> Result<Status, String> {
        Ok(Status {
            unavailable: Some(BUILD),
            models: Vec::new(),
            loaded: None,
            devices: Vec::new(),
            folder: models_dir(&app).map(|d| d.display().to_string()),
        })
    }

    #[tauri::command]
    pub async fn llm_download(
        _spec: DownloadSpec,
        _on_event: Channel<ProgressEvent>,
    ) -> Result<(), String> {
        Err(BUILD.into())
    }

    #[tauri::command]
    pub fn llm_download_cancel() {}

    #[tauri::command]
    pub async fn llm_remove(_file: String) -> Result<(), String> {
        Err(BUILD.into())
    }

    #[tauri::command]
    pub async fn llm_load(_file: String, _gpu: bool, _context: u32) -> Result<(), String> {
        Err(BUILD.into())
    }

    #[tauri::command]
    pub async fn llm_unload() -> Result<(), String> {
        Ok(())
    }

    #[tauri::command]
    pub async fn llm_generate(
        _prompt: String,
        _grammar: Option<String>,
        _max_tokens: u32,
        _on_token: Channel<TokenEvent>,
    ) -> Result<(), String> {
        Err(BUILD.into())
    }

    #[tauri::command]
    pub fn llm_cancel() {}
}

pub use real::*;

#[cfg(test)]
mod tests {
    use super::*;

    fn spec(over: impl FnOnce(&mut DownloadSpec)) -> DownloadSpec {
        let mut s = DownloadSpec {
            file: "Model-Q4_K_M.gguf".into(),
            url: "https://huggingface.co/org/repo/resolve/main/Model-Q4_K_M.gguf".into(),
            sha256: "a".repeat(64),
            bytes: 1_000_000,
        };
        over(&mut s);
        s
    }

    #[test]
    fn accepts_a_normal_spec() {
        assert_eq!(check_spec(&spec(|_| {})), Ok(()));
        assert!(allowed_url("https://cas-bridge.xethub.hf.co/x/y"));
        assert!(allowed_url("https://cdn-lfs.huggingface.co/repos/a"));
    }

    #[test]
    fn rejects_paths_hosts_and_bad_checksums() {
        for bad in [
            "../x.gguf",
            "a/b.gguf",
            "a\\b.gguf",
            ".hidden.gguf",
            "x.bin",
            ".gguf",
            "x y.gguf",
        ] {
            assert!(!valid_file_name(bad), "{bad}");
        }
        for url in [
            "http://huggingface.co/a",
            "https://evilhuggingface.co/a",
            "https://huggingface.co.evil.org/a",
            "https://user@huggingface.co/a",
            "https://huggingface.co:8443/a",
            "https://example.org/a",
            "file:///etc/passwd",
        ] {
            assert!(!allowed_url(url), "{url}");
        }
        assert_eq!(
            check_spec(&spec(|s| s.sha256 = "zz".into())),
            Err("bad-checksum")
        );
        assert_eq!(check_spec(&spec(|s| s.bytes = 0)), Err("bad-size"));
        assert_eq!(check_spec(&spec(|s| s.bytes = u64::MAX)), Err("bad-size"));
    }

    #[test]
    fn lists_only_verified_files() {
        let dir = std::env::temp_dir().join(format!("nemo-models-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("ok.gguf"), vec![0u8; 10]).unwrap();
        std::fs::write(dir.join("ok.gguf.sha256"), "x").unwrap();
        std::fs::write(dir.join("unverified.gguf"), vec![0u8; 5]).unwrap();
        std::fs::write(dir.join("partial.gguf.part"), vec![0u8; 5]).unwrap();
        assert_eq!(
            list_models(&dir),
            vec![ModelFile {
                file: "ok.gguf".into(),
                bytes: 10
            }]
        );
        let _ = std::fs::remove_dir_all(&dir);
    }
}
