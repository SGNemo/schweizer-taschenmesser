//! Browser extension bridge (desktop only): the thin Tauri side around the `vault_bridge` crate.
//!
//! The web app starts the pipe server with a channel; every request the native host relays arrives
//! there, the TypeScript handler (`web/src/modules/accounts/bridge`) decides what it means and
//! answers with `vault_bridge_respond`. Off by default – nothing listens until the app starts it,
//! and it stops with the app. Message bodies are never logged or stored here.

#[cfg(windows)]
use std::path::PathBuf;
use std::sync::Mutex;

use ::vault_bridge::ipc::Endpoint;
use ::vault_bridge::manifest::Registration;
use ::vault_bridge::server::{Responder, Server};
use serde::Serialize;
#[cfg(windows)]
use tauri::Manager as _;
use tauri::{ipc::Channel, AppHandle, State};

#[derive(Default)]
pub struct VaultBridge {
    server: Mutex<Option<Server>>,
    responder: Mutex<Option<Responder>>,
}

#[derive(Serialize, Clone)]
pub struct BridgeRequest {
    id: u64,
    body: String,
}

/// Current user's name, used to keep the channel per user.
pub fn user_name() -> String {
    std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_else(|_| "user".into())
}

pub fn endpoint() -> Endpoint {
    Endpoint::for_user(&user_name())
}

#[tauri::command]
pub fn vault_bridge_start(
    state: State<'_, VaultBridge>,
    on_request: Channel<BridgeRequest>,
) -> Result<(), String> {
    let mut slot = state.server.lock().map_err(|_| "failed")?;
    if let Some(mut old) = slot.take() {
        old.stop();
    }
    let server = Server::start(endpoint(), move |forwarded| {
        on_request
            .send(BridgeRequest {
                id: forwarded.id,
                body: forwarded.body,
            })
            .is_ok()
    })
    .map_err(|e| match e.kind() {
        std::io::ErrorKind::AddrInUse | std::io::ErrorKind::PermissionDenied => "channel-taken",
        _ => "failed",
    })?;
    *state.responder.lock().map_err(|_| "failed")? = Some(server.responder());
    *slot = Some(server);
    Ok(())
}

#[tauri::command]
pub fn vault_bridge_respond(state: State<'_, VaultBridge>, id: u64, body: String) -> bool {
    state
        .responder
        .lock()
        .ok()
        .and_then(|r| r.as_ref().map(|r| r.respond(id, body)))
        .unwrap_or(false)
}

#[tauri::command]
pub fn vault_bridge_stop(state: State<'_, VaultBridge>) {
    if let Ok(mut slot) = state.server.lock() {
        if let Some(mut server) = slot.take() {
            server.stop();
        }
    }
    if let Ok(mut responder) = state.responder.lock() {
        *responder = None;
    }
}

/// Folder for the host manifest: next to the portable executable (`data/`), otherwise the user's
/// local app data.
#[cfg(windows)]
fn data_dir(app: &AppHandle, exe: &std::path::Path) -> Result<PathBuf, String> {
    crate::portable::data_dir(exe, &app.config().identifier)
        .or_else(|| app.path().app_local_data_dir().ok())
        .ok_or_else(|| "no-data-dir".to_owned())
}

#[cfg(windows)]
#[tauri::command]
pub fn vault_bridge_register(app: AppHandle) -> Result<Registration, String> {
    let exe = std::env::current_exe().map_err(|_| "failed")?;
    let dir = data_dir(&app, &exe)?;
    ::vault_bridge::registry::register(&exe, &dir).map_err(|_| "failed".to_owned())
}

#[cfg(windows)]
#[tauri::command]
pub fn vault_bridge_status(app: AppHandle) -> Result<Registration, String> {
    let exe = std::env::current_exe().map_err(|_| "failed")?;
    let dir = data_dir(&app, &exe)?;
    ::vault_bridge::registry::status(&exe, &dir).map_err(|_| "failed".to_owned())
}

#[cfg(windows)]
#[tauri::command]
pub fn vault_bridge_unregister(app: AppHandle) -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|_| "failed")?;
    let dir = data_dir(&app, &exe)?;
    ::vault_bridge::registry::unregister(&dir).map_err(|_| "failed".to_owned())
}

// Browser registration is a Windows registry matter; elsewhere the commands exist (the handler list
// is the same on every desktop OS) and report that they are unsupported.
#[cfg(not(windows))]
#[tauri::command]
pub fn vault_bridge_register(_app: AppHandle) -> Result<Registration, String> {
    Err("unsupported".into())
}

#[cfg(not(windows))]
#[tauri::command]
pub fn vault_bridge_status(_app: AppHandle) -> Result<Registration, String> {
    Err("unsupported".into())
}

#[cfg(not(windows))]
#[tauri::command]
pub fn vault_bridge_unregister(_app: AppHandle) -> Result<(), String> {
    Err("unsupported".into())
}
