//! Local AI import API (desktop only): the thin Tauri side around the `local_api` crate.
//!
//! The web app starts the server with the token hashes (never the tokens) and a channel; every
//! request that passed the transport checks arrives there as `Forwarded`, and the app answers with
//! `local_api_respond`. Off by default – nothing listens until the app calls `local_api_start`, and
//! the server stops with the app.

use std::sync::Mutex;

use ::local_api::{parse_hash_hex, Forwarded, Limits, Reply, Server, TokenEntry};
use serde::Deserialize;
use tauri::{ipc::Channel, State};

#[derive(Default)]
pub struct LocalApi(Mutex<Option<Server>>);

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenArg {
    id: String,
    /// SHA-256 of the token, 64 hex characters.
    hash: String,
    expires_at: Option<u64>,
}

fn to_entries(tokens: Vec<TokenArg>) -> Result<Vec<TokenEntry>, String> {
    tokens
        .into_iter()
        .map(|t| {
            let hash = parse_hash_hex(&t.hash).ok_or("bad-token-hash")?;
            Ok(TokenEntry {
                id: t.id,
                hash,
                expires_at_ms: t.expires_at,
            })
        })
        .collect()
}

/// Starts (or restarts) the server on `127.0.0.1:<port>`.
#[tauri::command]
pub fn local_api_start(
    state: State<'_, LocalApi>,
    port: u16,
    tokens: Vec<TokenArg>,
    on_request: Channel<Forwarded>,
) -> Result<u16, String> {
    if port < 1024 {
        return Err("bad-port".into());
    }
    let entries = to_entries(tokens)?;
    let mut slot = state.0.lock().map_err(|_| "internal")?;
    if let Some(old) = slot.take() {
        old.stop();
    }
    let server = Server::start(port, entries, Limits::default(), move |req| {
        on_request.send(req).is_ok()
    })
    .map_err(|e| match e.kind() {
        std::io::ErrorKind::AddrInUse => "port-in-use".to_string(),
        std::io::ErrorKind::PermissionDenied => "port-denied".to_string(),
        _ => "listen-failed".to_string(),
    })?;
    let bound = server.local_addr().port();
    *slot = Some(server);
    Ok(bound)
}

#[tauri::command]
pub fn local_api_stop(state: State<'_, LocalApi>) -> Result<(), String> {
    let server = state.0.lock().map_err(|_| "internal")?.take();
    if let Some(server) = server {
        server.stop();
    }
    Ok(())
}

/// New, revoked or changed tokens take effect for the next request.
#[tauri::command]
pub fn local_api_set_tokens(
    state: State<'_, LocalApi>,
    tokens: Vec<TokenArg>,
) -> Result<(), String> {
    let entries = to_entries(tokens)?;
    if let Some(server) = state.0.lock().map_err(|_| "internal")?.as_ref() {
        server.set_tokens(entries);
    }
    Ok(())
}

/// The app's answer to a forwarded request.
#[tauri::command]
pub fn local_api_respond(
    state: State<'_, LocalApi>,
    id: u64,
    status: u16,
    body: String,
) -> Result<bool, String> {
    let guard = state.0.lock().map_err(|_| "internal")?;
    Ok(guard
        .as_ref()
        .is_some_and(|server| server.respond(id, Reply { status, body })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_hashes_must_be_hex() {
        let ok = TokenArg {
            id: "a".into(),
            hash: "ab".repeat(32),
            expires_at: None,
        };
        assert_eq!(to_entries(vec![ok]).unwrap()[0].hash, [0xab; 32]);
        let bad = TokenArg {
            id: "a".into(),
            hash: "tm_plain-token".into(),
            expires_at: None,
        };
        assert!(to_entries(vec![bad]).is_err());
    }
}
