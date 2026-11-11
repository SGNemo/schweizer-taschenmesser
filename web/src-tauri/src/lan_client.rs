//! Home-network sync, device side (Android, and a second PC that pairs with the hub PC): pairing
//! with a hub PC by its QR and the requests of the web app's sync engine. Thin glue around
//! `lan_sync::client` (tested there, incl. the "open once more" rule of `client::Link`).
//!
//! * Keys: the device's static Noise key and the pinned hub (key, address, name) sit in the OS
//!   keystore through the secure-store plugin under the Rust-only prefix `lan-client:` (Android
//!   Keystore; on the desktop `keyring`, i.e. the Windows Credential Manager, with the app identifier
//!   as service name like the hub keys of `lan_sync.rs`) – the plugin's webview commands refuse
//!   those names, so the static key never leaves Rust.
//! * One path per device: a PC is either the hub or a client. Pairing is refused (`hub-on`) while
//!   this PC's hub runs, and `lan_hub_start` refuses (`client-paired`) while a hub is pinned here. The only
//!   secret handed to the web app is the data key, once, right after the pairing was confirmed on
//!   the PC; the web app imports it as a non-extractable `CryptoKey`.
//! * Every pairing uses a FRESH static key ("Neu koppeln" after the PC unpaired this device must
//!   work: the hub never trusts an unpaired key again). It is stored only after the data key
//!   arrived; the previous hub gets a best-effort `unpair` with the previous key.
//! * One pairing at a time; nothing here logs; errors are short codes.
//! * A PC with a new address (CONCEPT §4, package 4): only when a round cannot open a session at the
//!   pinned address, the `lan-watch` plugin browses `_nemo-sync._tcp` (Rust-only call), the pinned
//!   hub's daily hint picks the candidates (`lan_sync::rediscover`), the first address where the
//!   pinned `IK` handshake succeeds becomes the new `HubEntry.addr`. Hub key and hint never leave
//!   Rust; the web app only sees the round succeed.

use ::lan_sync::client::{self, ClientError, Link, Session};
use ::lan_sync::noise::{PublicKey, StaticKey};
use ::lan_sync::rediscover::{self, Found};
use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use serde::{Deserialize, Serialize};
use std::net::SocketAddrV4;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_lan_watch::LanWatchExt;
use tauri_plugin_secure_store::{NameRequest, SecureStoreExt, SetRequest};
use zeroize::Zeroizing;

const KEY_NAME: &str = "lan-client:static-key";
const HUB_NAME: &str = "lan-client:hub";

/// How long one search for a moved PC listens (a failed round waits for it).
const SEARCH_MS: u64 = 3_000;
/// At most one search in this time: away from home every round fails, and each search sends mDNS
/// queries on whatever network the phone is on.
const SEARCH_EVERY: Duration = Duration::from_secs(30);

#[derive(Default)]
pub struct LanClient {
    link: Mutex<Link>,
    cancel: Arc<AtomicBool>,
    pairing: AtomicBool,
    last_search: Mutex<Option<Instant>>,
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
    /// Hex of the hub's static public key: the web app passes it with every request, so a round of
    /// a previous pairing never reaches a newly paired PC.
    hub: String,
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

/// The remote control's session with the old PC, what that PC said and the unlock given for it
/// go with the pairing – on unpairing and when another PC is paired.
fn reset_remote<R: Runtime>(app: &AppHandle<R>) {
    #[cfg(any(mobile, test))]
    if let Some(remote) = app.try_state::<crate::remote_client::RemoteClient>() {
        remote.reset();
    }
    #[cfg(not(any(mobile, test)))]
    let _ = app;
}

fn forget<R: Runtime>(app: &AppHandle<R>) {
    reset_remote(app);
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

pub(crate) fn stored_key<R: Runtime>(app: &AppHandle<R>) -> Result<StaticKey, String> {
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

pub(crate) fn hub_entry<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<(PublicKey, SocketAddrV4, String), String> {
    let text = get(app, HUB_NAME)?.ok_or("not-paired")?;
    let entry: HubEntry = serde_json::from_str(&text).map_err(|_| "not-paired")?;
    let hub = hex32(&entry.hub).ok_or("not-paired")?;
    let addr: SocketAddrV4 = entry.addr.parse().map_err(|_| "not-paired")?;
    Ok((PublicKey::from_bytes(hub), addr, entry.name))
}

/// A hub is pinned on this device (it syncs as a client). A keystore that does not answer counts as
/// "not paired": the hub start then fails on the same keystore anyway.
pub fn is_paired<R: Runtime>(app: &AppHandle<R>) -> bool {
    matches!(get(app, HUB_NAME), Ok(Some(_)))
}

/// This PC is the hub right now (desktop); a phone never is.
#[cfg(desktop)]
fn hub_running<R: Runtime>(app: &AppHandle<R>) -> bool {
    app.try_state::<crate::lan_sync::LanSync>()
        .is_some_and(|s| s.is_running())
}

#[cfg(not(desktop))]
fn hub_running<R: Runtime>(_app: &AppHandle<R>) -> bool {
    false
}

/// Only a missing pairing is "unknown device"; a keystore that does not answer right now is a calm,
/// retried `network` (it must never look like "the PC unpaired this device").
fn missing_or_retry(e: String) -> ClientError {
    if e == "not-paired" {
        ClientError::UnknownDevice
    } else {
        ClientError::Network
    }
}

fn open<R: Runtime>(app: &AppHandle<R>) -> Result<Session, ClientError> {
    let (hub, addr, name) = hub_entry(app).map_err(missing_or_retry)?;
    let key = stored_key(app).map_err(missing_or_retry)?;
    Session::open(addr, &key, &hub, &name)
}

/// True once per [`SEARCH_EVERY`]: the caller may search now.
fn search_due(last: &Mutex<Option<Instant>>, now: Instant) -> bool {
    let Ok(mut last) = last.lock() else {
        return false;
    };
    if last.is_some_and(|at| now.saturating_duration_since(at) < SEARCH_EVERY) {
        return false;
    }
    *last = Some(now);
    true
}

fn unix_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// The pinned PC did not answer at its address: look for it on the current network by its daily
/// hint, open a pinned session at the first candidate that proves to be the hub, and remember that
/// address. `Ok(None)` = not found (calm `network` for the caller); `UnknownDevice` only for the
/// hub's authenticated refusal at the new address. Call with the link lock held.
fn find_hub_again<R: Runtime>(app: &AppHandle<R>) -> Result<Option<Session>, ClientError> {
    // without Wi-Fi there is nothing to find, and the slot stays free for the round when it comes up
    let on_wifi = app.lan_watch().wifi_state().is_ok_and(|w| w.connected);
    if !on_wifi || !search_due(&app.state::<LanClient>().last_search, Instant::now()) {
        return Ok(None);
    }
    let (hub, failed, name) = hub_entry(app).map_err(missing_or_retry)?;
    let key = stored_key(app).map_err(missing_or_retry)?;
    let found: Vec<Found> = app
        .lan_watch()
        .discover(SEARCH_MS)
        .unwrap_or_default()
        .into_iter()
        .filter_map(|s| {
            Some(Found {
                ipv4: s.host.parse().ok()?,
                port: s.port,
                version: s.v,
                hint: s.h,
            })
        })
        .collect();
    let candidates = rediscover::candidates(&found, &hub, unix_secs(), failed);
    let Some((addr, session)) =
        rediscover::first_that_opens(&candidates, &mut |a| Session::open(a, &key, &hub, &name))?
    else {
        return Ok(None);
    };
    // same hub, same name, new address; if the keystore does not take it, the next round searches again
    if let Ok(json) = serde_json::to_string(&HubEntry {
        hub: to_hex(hub.as_bytes()),
        addr: addr.to_string(),
        name,
    }) {
        let _ = set(app, HUB_NAME, json);
    }
    Ok(Some(session))
}

/// Best effort, once: tells the currently pinned hub that this device leaves (the hub revokes its
/// key). An unreachable PC keeps listing the device until it is unpaired there.
fn tell_hub_goodbye<R: Runtime>(app: &AppHandle<R>) {
    if let Ok(session) = open(app) {
        let _ = session.unpair();
    }
}

/// `unpair` to a hub given by its stored entries (used for the previous pairing after a new one).
fn goodbye_with(key_text: &str, hub_text: &str) {
    let Ok(raw) = STANDARD.decode(key_text.as_bytes()).map(Zeroizing::new) else {
        return;
    };
    if raw.len() != 32 {
        return;
    }
    let mut secret = Zeroizing::new([0u8; 32]);
    secret.copy_from_slice(&raw);
    let (Ok(key), Ok(entry)) = (
        StaticKey::from_secret_bytes(secret),
        serde_json::from_str::<HubEntry>(hub_text),
    ) else {
        return;
    };
    let (Some(hub), Ok(addr)) = (hex32(&entry.hub), entry.addr.parse::<SocketAddrV4>()) else {
        return;
    };
    if let Ok(s) = Session::open(addr, &key, &PublicKey::from_bytes(hub), &entry.name) {
        let _ = s.unpair();
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
    // one path per device: the hub PC never becomes a client of another hub
    if hub_running(&app) {
        return Err("hub-on".to_owned());
    }
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
        // the previous pairing (another PC, or this one before "Neu koppeln"), kept until the new one
        // is stored for good
        let previous = (get(&app, KEY_NAME), get(&app, HUB_NAME));
        let entry = HubEntry {
            hub: to_hex(paired.hub_key.as_bytes()),
            addr: paired.addr.to_string(),
            name: client::hello_name(&name),
        };
        let stored = serde_json::to_string(&entry)
            .map_err(|_| "internal".to_owned())
            .and_then(|json| {
                set(&app, KEY_NAME, STANDARD.encode(&key.to_secret_bytes()[..]))?;
                set(&app, HUB_NAME, json)
            });
        // paired anew (the same PC or another one): nothing of the old pairing's remote control stays
        reset_remote(&app);
        if let Err(e) = stored {
            // the new PC trusts a key this device cannot keep: undo it there, put the old entries back
            if let Ok(s) = Session::open(paired.addr, &key, &paired.hub_key, &entry.name) {
                let _ = s.unpair();
            }
            match previous {
                (Ok(Some(k)), Ok(Some(h))) => {
                    let _ = set(&app, KEY_NAME, k);
                    let _ = set(&app, HUB_NAME, h);
                }
                _ => forget(&app),
            }
            return Err(e);
        }
        // now say goodbye to the previous hub with the previous key (best effort, once)
        if let (Ok(Some(k)), Ok(Some(h))) = previous {
            goodbye_with(&k, &h);
        }
        Ok(DataKeyDto {
            version: paired.data_key_version,
            key: STANDARD.encode(&paired.data_key[..]),
            hub: entry.hub,
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
    hub: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<LanClient>();
        // during a pairing, and for a round that belongs to another pairing: nothing goes out (calm)
        if state.pairing.load(Ordering::SeqCst) {
            return Err("network".to_owned());
        }
        let mut link = state.link.lock().map_err(|_| "internal")?;
        match hub_entry(&app) {
            Ok((pinned, _, _)) if to_hex(pinned.as_bytes()) == hub => {}
            Ok(_) => return Err("network".to_owned()),
            Err(e) => return Err(code(missing_or_retry(e))),
        }
        // only a session that could not be opened at the pinned address means "maybe moved"
        let mut open_failed = false;
        let first = link.request(body.as_bytes(), &mut || {
            open(&app).inspect_err(|e| open_failed |= *e == ClientError::Network)
        });
        let answer = match first {
            Err(ClientError::Network) if open_failed => match find_hub_again(&app) {
                Ok(Some(session)) => {
                    let mut fresh = Some(session);
                    link.request(body.as_bytes(), &mut || {
                        fresh.take().ok_or(ClientError::Network)
                    })
                }
                Ok(None) => Err(ClientError::Network),
                Err(e) => Err(e),
            },
            other => other,
        }
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
    use tauri_plugin_secure_store::RUST_ONLY_PREFIX;

    #[test]
    fn hex_round_trip() {
        let b = [0xab_u8; 32];
        assert_eq!(hex32(&to_hex(&b)), Some(b));
        assert_eq!(hex32("zz"), None);
    }

    #[test]
    fn a_search_at_most_every_thirty_seconds() {
        let last = Mutex::new(None);
        let t0 = Instant::now();
        assert!(search_due(&last, t0));
        assert!(!search_due(&last, t0 + Duration::from_secs(29)));
        assert!(search_due(&last, t0 + SEARCH_EVERY));
        assert!(!search_due(
            &last,
            t0 + SEARCH_EVERY + Duration::from_secs(1)
        ));
    }

    /// The web app never learns where the PC is or what it announces: no command returns an
    /// address, a hint or the hub's search results (the hub key goes out only as the pin it gave).
    #[test]
    fn the_search_stays_in_rust() {
        let src = include_str!("lan_client.rs");
        let production = &src[..src.find("#[cfg(test)]").unwrap()];
        assert!(!production.contains("Channel<Vec"));
        assert!(!production.contains("emit("));
        assert_eq!(
            production.matches("#[derive(Serialize)]").count(),
            1,
            "only DataKeyDto"
        );
    }

    #[test]
    fn the_keys_live_under_the_rust_only_prefix() {
        assert!(KEY_NAME.starts_with(RUST_ONLY_PREFIX));
        assert!(HUB_NAME.starts_with(RUST_ONLY_PREFIX));
    }
}
