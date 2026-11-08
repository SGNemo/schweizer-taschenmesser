//! Home-network sync, device side (Android and a second PC): pairing with a hub PC by its QR and the
//! requests of the web app's sync engine. Thin glue around `lan_sync::client` (tested there).
//!
//! * Keys: the device's static Noise key and the pinned hub (key, address, name) sit in the OS
//!   keystore through the secure-store plugin (Android Keystore, Windows Credential Manager). The
//!   static key never leaves Rust. The only secret handed to the web app is the data key, once,
//!   right after the pairing was confirmed on the PC; the web app imports it as a non-extractable
//!   `CryptoKey`.
//! * One session at a time, kept open between requests and opened again once after a dropped
//!   connection.
//! * Nothing here logs; errors are short codes.

use ::lan_sync::client::{self, ClientError, Session};
use ::lan_sync::noise::{PublicKey, StaticKey};
use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use serde::{Deserialize, Serialize};
use std::net::SocketAddrV4;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_secure_store::{NameRequest, SecureStoreExt, SetRequest};
use zeroize::Zeroizing;

const KEY_NAME: &str = "lan-client:static-key";
const HUB_NAME: &str = "lan-client:hub";

#[derive(Default)]
pub struct LanClient {
    session: Mutex<Option<Session>>,
    cancel: Arc<AtomicBool>,
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

/// The device's static key; created on first use. A keystore error means no pairing at all.
fn static_key<R: Runtime>(app: &AppHandle<R>, create: bool) -> Result<StaticKey, String> {
    if let Some(text) = get(app, KEY_NAME)? {
        let raw = Zeroizing::new(
            STANDARD
                .decode(text.as_bytes())
                .map_err(|_| "keystore-unavailable")?,
        );
        let mut secret = Zeroizing::new([0u8; 32]);
        if raw.len() != 32 {
            return Err("keystore-unavailable".to_owned());
        }
        secret.copy_from_slice(&raw);
        return StaticKey::from_secret_bytes(secret).map_err(|_| "keystore-unavailable".to_owned());
    }
    if !create {
        return Err("not-paired".to_owned());
    }
    let key = StaticKey::generate().map_err(|_| "internal".to_owned())?;
    set(app, KEY_NAME, STANDARD.encode(&key.to_secret_bytes()[..]))?;
    Ok(key)
}

fn hub_entry<R: Runtime>(app: &AppHandle<R>) -> Result<(PublicKey, SocketAddrV4, String), String> {
    let text = get(app, HUB_NAME)?.ok_or("not-paired")?;
    let entry: HubEntry = serde_json::from_str(&text).map_err(|_| "not-paired")?;
    let hub = hex32(&entry.hub).ok_or("not-paired")?;
    let addr: SocketAddrV4 = entry.addr.parse().map_err(|_| "not-paired")?;
    Ok((PublicKey::from_bytes(hub), addr, entry.name))
}

fn open<R: Runtime>(app: &AppHandle<R>) -> Result<Session, String> {
    let (hub, addr, name) = hub_entry(app)?;
    let key = static_key(app, false)?;
    Session::open(addr, &key, &hub, &name).map_err(code)
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
    let cancel = app.state::<LanClient>().cancel.clone();
    cancel.store(false, Ordering::SeqCst);
    tauri::async_runtime::spawn_blocking(move || {
        let key = static_key(&app, true)?;
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
        let entry = HubEntry {
            hub: to_hex(paired.hub_key.as_bytes()),
            addr: paired.addr.to_string(),
            name: client::hello_name(&name),
        };
        set(
            &app,
            HUB_NAME,
            serde_json::to_string(&entry).map_err(|_| "internal")?,
        )?;
        if let Ok(mut s) = app.state::<LanClient>().session.lock() {
            *s = None;
        }
        Ok(DataKeyDto {
            version: paired.data_key_version,
            key: STANDARD.encode(&paired.data_key[..]),
        })
    })
    .await
    .map_err(|_| "internal".to_owned())?
}

/// Stops waiting for the confirmation on the PC.
#[tauri::command]
pub fn lan_client_pair_cancel<R: Runtime>(app: AppHandle<R>) {
    app.state::<LanClient>()
        .cancel
        .store(true, Ordering::SeqCst);
}

/// One request of the sync engine (JSON, see `crates/lan-sync/src/hub/handler.rs`).
#[tauri::command]
pub async fn lan_client_request<R: Runtime>(
    app: AppHandle<R>,
    body: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<LanClient>();
        let mut slot = state.session.lock().map_err(|_| "internal")?;
        for attempt in 0..2 {
            if slot.is_none() {
                *slot = Some(open(&app)?);
            }
            let Some(session) = slot.as_mut() else {
                return Err("internal".to_owned());
            };
            match session.request(body.as_bytes()) {
                Ok(answer) => {
                    return String::from_utf8(answer.to_vec()).map_err(|_| "protocol".to_owned())
                }
                // a kept connection the hub closed meanwhile: open a fresh one once
                Err(ClientError::Network) if attempt == 0 => *slot = None,
                Err(e) => {
                    *slot = None;
                    return Err(code(e));
                }
            }
        }
        Err("network".to_owned())
    })
    .await
    .map_err(|_| "internal".to_owned())?
}

/// "Kopplung lösen" on the device: tells the hub when it is reachable, then forgets hub and key.
#[tauri::command]
pub async fn lan_client_unpair<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        if let Ok(mut s) = app.state::<LanClient>().session.lock() {
            *s = None;
        }
        if let Ok(session) = open(&app) {
            let _ = session.unpair();
        }
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
}
