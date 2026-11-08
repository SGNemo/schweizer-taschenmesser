//! Home-network sync, device side (Android): pairing with a hub PC by its QR and the requests of
//! the web app's sync engine. Thin glue around `lan_sync::client` (tested there, incl. the
//! "open once more" rule of `client::Link`).
//!
//! * Keys: the device's static Noise key and the pinned hub (key, address, name) sit in the OS
//!   keystore through the secure-store plugin under the Rust-only prefix `lan-client:` – the
//!   plugin's webview commands refuse those names, so the static key never leaves Rust. The only
//!   secret handed to the web app is the data key, once, right after the pairing was confirmed on
//!   the PC; the web app imports it as a non-extractable `CryptoKey`.
//! * Every pairing uses a FRESH static key ("Neu koppeln" after the PC unpaired this device must
//!   work: the hub never trusts an unpaired key again). It is stored only after the data key
//!   arrived; the previous hub gets a best-effort `unpair` with the previous key.
//! * One pairing at a time; nothing here logs; errors are short codes.

use ::lan_sync::client::{self, ClientError, Link, Session};
use ::lan_sync::noise::{PublicKey, StaticKey};
use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use serde::{Deserialize, Serialize};
use std::net::SocketAddrV4;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_secure_store::{NameRequest, SecureStoreExt, SetRequest, RUST_ONLY_PREFIX};
use zeroize::Zeroizing;

const KEY_NAME: &str = "lan-client:static-key";
const HUB_NAME: &str = "lan-client:hub";

#[derive(Default)]
pub struct LanClient {
    link: Mutex<Link>,
    cancel: Arc<AtomicBool>,
    pairing: AtomicBool,
}

/// The pinned hub, stored as JSON in the keystore.
#[derive(Serialize, Deserialize)]
struct HubEntry {
    /// Hex of the hub's static public key.
    hub: String,
    /// `a.b.c.d:port` (private IPv4 only; `Session::open` checks again).
    addr: String,
    /// This device's name as sent in `hello`.
    name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataKeyDto {
    version: u32,
    /// base64 of the 32-byte key.
    key: String,
}

fn code(e: ClientError) -> String {
    match e {
        ClientError::BadQr => "bad-qr",
        ClientError::Network => "network",
        ClientError::PairingNotPossible => "pairing-not-possible",
        ClientError::PairingAborted => "pairing-aborted",
        ClientError::UnknownDevice => "unknown-device",
        ClientError::Cancelled => "cancelled",
        ClientError::Protocol => "protocol",
    }
    .to_owned()
}

fn get<R: Runtime>(app: &AppHandle<R>, name: &str) -> Result<Option<String>, String> {
    app.secure_store()
        .get(NameRequest {
            name: name.to_owned(),
        })
        .map(|r| r.value)
        .map_err(|_| "keystore-unavailable".to_owned())
}

fn set<R: Runtime>(app: &AppHandle<R>, name: &str, value: String) -> Result<(), String> {
    app.secure_store()
        .set(SetRequest {
            name: name.to_owned(),
            value,
        })
        .map_err(|_| "keystore-unavailable".to_owned())
}

fn forget<R: Runtime>(app: &AppHandle<R>) {
    for name in [HUB_NAME, KEY_NAME] {
        let _ = app.secure_store().delete(NameRequest {
            name: name.to_owned(),
        });
    }
}

fn hex32(text: &str) -> Option<[u8; 32]> {
    if text.len() != 64 {
        return None;
    }
    let mut out = [0u8; 32];
    for (i, chunk) in text.as_bytes().chunks(2).enumerate() {
        let s = std::str::from_utf8(chunk).ok()?;
        out[i] = u8::from_str_radix(s, 16).ok()?;
    }
    Some(out)
}

fn to_hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push(char::from(DIGITS[usize::from(b >> 4)]));
        s.push(char::from(DIGITS[usize::from(b & 0x0f)]));
    }
    s
}

fn stored_key<R: Runtime>(app: &AppHandle<R>) -> Result<StaticKey, String> {
    let text = get(app, KEY_NAME)?.ok_or("not-paired")?;
    let raw = Zeroizing::new(
        STANDARD
            .decode(text.as_bytes())
            .map_err(|_| "keystore-unavailable")?,
    );
    if raw.len() != 32 {
        return Err("keystore-unavailable".to_owned());
    }
    let mut secret = Zeroizing::new([0u8; 32]);
    secret.copy_from_slice(&raw);
    StaticKey::from_secret_bytes(secret).map_err(|_| "keystore-unavailable".to_owned())
}

fn hub_entry<R: Runtime>(app: &AppHandle<R>) -> Result<(PublicKey, SocketAddrV4, String), String> {
    let text = get(app, HUB_NAME)?.ok_or("not-paired")?;
    let entry: HubEntry = serde_json::from_str(&text).map_err(|_| "not-paired")?;
    let hub = hex32(&entry.hub).ok_or("not-paired")?;
    let addr: SocketAddrV4 = entry.addr.parse().map_err(|_| "not-paired")?;
    Ok((PublicKey::from_bytes(hub), addr, entry.name))
}

fn open<R: Runtime>(app: &AppHandle<R>) -> Result<Session, ClientError> {
    let (hub, addr, name) = hub_entry(app).map_err(|_| ClientError::UnknownDevice)?;
    let key = stored_key(app).map_err(|_| ClientError::UnknownDevice)?;
    Session::open(addr, &key, &hub, &name)
}

/// Best effort, once: tells the currently pinned hub that this device leaves (the hub revokes its
/// key). An unreachable PC keeps listing the device until it is unpaired there.
fn tell_hub_goodbye<R: Runtime>(app: &AppHandle<R>) {
    if let Ok(session) = open(app) {
        let _ = session.unpair();
    }
}

/// Pairs with the hub of `qr`. `on_code` gets the 6-digit code to show ("Am PC bestätigen · Code …")
/// as soon as the handshake is done; the call returns once the user confirmed on the PC.
#[tauri::command]
pub async fn lan_client_pair<R: Runtime>(
    app: AppHandle<R>,
    qr: String,
    name: String,
    on_code: Channel<String>,
) -> Result<DataKeyDto, String> {
    let state = app.state::<LanClient>();
    if state.pairing.swap(true, Ordering::SeqCst) {
        return Err("busy".to_owned());
    }
    state.cancel.store(false, Ordering::SeqCst);
    let cancel = state.cancel.clone();
    let worker = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let app = worker;
        let key = StaticKey::generate().map_err(|_| "internal".to_owned())?;
        let paired = client::pair(
            &qr,
            &key,
            &name,
            &mut |code| {
                let _ = on_code.send(code.to_owned());
            },
            &|| cancel.load(Ordering::SeqCst),
        )
        .map_err(code)?;
        let state = app.state::<LanClient>();
        let mut link = state.link.lock().map_err(|_| "internal")?;
        link.close();
        // a previous pairing (another PC, or this one before "Neu koppeln"): say goodbye with the old key
        tell_hub_goodbye(&app);
        let entry = HubEntry {
            hub: to_hex(paired.hub_key.as_bytes()),
            addr: paired.addr.to_string(),
            name: client::hello_name(&name),
        };
        set(&app, KEY_NAME, STANDARD.encode(&key.to_secret_bytes()[..]))?;
        set(
            &app,
            HUB_NAME,
            serde_json::to_string(&entry).map_err(|_| "internal")?,
        )?;
        Ok(DataKeyDto {
            version: paired.data_key_version,
            key: STANDARD.encode(&paired.data_key[..]),
        })
    })
    .await
    .map_err(|_| "internal".to_owned())
    .and_then(|r| r);
    app.state::<LanClient>()
        .pairing
        .store(false, Ordering::SeqCst);
    result
}

/// Stops waiting (for the PC to answer, or for the confirmation there).
#[tauri::command]
pub fn lan_client_pair_cancel<R: Runtime>(app: AppHandle<R>) {
    let state = app.state::<LanClient>();
    if state.pairing.load(Ordering::SeqCst) {
        state.cancel.store(true, Ordering::SeqCst);
    }
}

/// One request of the sync engine (JSON, see `crates/lan-sync/src/hub/handler.rs`).
#[tauri::command]
pub async fn lan_client_request<R: Runtime>(
    app: AppHandle<R>,
    body: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<LanClient>();
        let mut link = state.link.lock().map_err(|_| "internal")?;
        let answer = link
            .request(body.as_bytes(), &mut || open(&app))
            .map_err(code)?;
        String::from_utf8(answer.to_vec()).map_err(|_| "protocol".to_owned())
    })
    .await
    .map_err(|_| "internal".to_owned())?
}

/// "Kopplung lösen" on the device: tells the hub once if it is reachable right now, then forgets
/// hub and key. If the PC was not reachable it keeps listing this device until it is unpaired there.
#[tauri::command]
pub async fn lan_client_unpair<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<LanClient>();
        // held throughout, so no request reopens a session in between
        let mut link = state.link.lock().map_err(|_| "internal")?;
        link.close();
        tell_hub_goodbye(&app);
        forget(&app);
        Ok(())
    })
    .await
    .map_err(|_| "internal".to_owned())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hex_round_trip() {
        let b = [0xab_u8; 32];
        assert_eq!(hex32(&to_hex(&b)), Some(b));
        assert_eq!(hex32("zz"), None);
    }

    #[test]
    fn the_keys_live_under_the_rust_only_prefix() {
        assert!(KEY_NAME.starts_with(RUST_ONLY_PREFIX));
        assert!(HUB_NAME.starts_with(RUST_ONLY_PREFIX));
    }
}
