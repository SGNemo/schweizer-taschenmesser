//! Home-network sync hub (desktop only): the thin Tauri side around the `lan_sync` crate.
//!
//! Everything that decides something lives in the crate (and is tested there); this file only
//! wires the pieces to the OS and to the web app:
//! * keys: the static Noise key and the versioned data key sit in the OS keystore (`keyring`,
//!   own service name per app identifier); any keystore error means the hub does not start,
//! * network: the Windows network list decides whether and where the hub may listen
//!   (`lan_sync_net.rs`); other systems never listen,
//! * a supervisor thread re-evaluates every two seconds and after every command, drains the pairing
//!   events and tears the sockets down on any change of the network or the wish.
//!
//! Own listener and own port, never shared with the Local API. Nothing here logs; the only secret
//! that reaches the web app is the data key, returned by `lan_hub_start` and `lan_hub_rotate`.

use crate::lan_sync_net::SystemNetwork;
use ::lan_sync::endpoint::Endpoint;
use ::lan_sync::hub::home::FileHomeNetwork;
use ::lan_sync::hub::netpolicy::{
    IfaceInfo, NetCategory, NetError, NetworkInfo, OffReason, Wanted,
};
use ::lan_sync::hub::router::{Admission, Router};
use ::lan_sync::hub::Hub;
use ::lan_sync::keys::{DataKeys, SecretSlot, SlotError, SlotKeyStore};
use ::lan_sync::noise::PublicKey;
use ::lan_sync::pairing::{PairError, PairingEvent, PairingHost, SystemClock};
use ::lan_sync::supervisor::{Live, RealLauncher, Status, Supervisor};
use ::lan_sync::transport::ServerConfig;
use ::lan_sync::trust::file::{from_hex32, to_hex};
use ::lan_sync::trust::{Device, FileTrustStore, SessionRegistry, StaticKeyStore, TrustStore};
use ::lan_sync::Store;
use base64::Engine as _;
use serde::Serialize;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, State};
use zeroize::Zeroizing;

const TICK: Duration = Duration::from_secs(2);

#[derive(Default)]
pub struct LanSync(Mutex<Option<Running>>);

struct Running {
    core: Arc<Core>,
    stop: Arc<AtomicBool>,
    wake: Sender<()>,
    thread: Option<JoinHandle<()>>,
}

struct Core {
    hub: Arc<Hub>,
    host: Arc<PairingHost>,
    trust: Arc<FileTrustStore>,
    sessions: Arc<SessionRegistry>,
    data_keys: DataKeys<KeyringSlot>,
    home: FileHomeNetwork,
    live: Mutex<LiveState>,
}

struct LiveState {
    sup: Supervisor<RealLauncher>,
    status: Status,
    pending: Option<Pending>,
}

#[derive(Clone)]
struct Pending {
    attempt: u64,
    name: String,
    code: String,
}

/// One keystore entry. The service name carries the app identifier, so the stable app and the
/// Dev-Preview never share hub keys.
struct KeyringSlot {
    service: String,
    name: &'static str,
}

impl KeyringSlot {
    fn entry(&self) -> Result<keyring::Entry, SlotError> {
        keyring::Entry::new(&self.service, self.name).map_err(|_| SlotError)
    }
}

impl SecretSlot for KeyringSlot {
    fn get(&self) -> Result<Option<Zeroizing<Vec<u8>>>, SlotError> {
        match self.entry()?.get_secret() {
            Ok(v) => Ok(Some(Zeroizing::new(v))),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Err(SlotError),
        }
    }

    fn set(&self, bytes: &[u8]) -> Result<(), SlotError> {
        self.entry()?.set_secret(bytes).map_err(|_| SlotError)
    }
}

/// One reading of the interfaces, so the decision and the home-network id come from the same moment.
struct Snapshot(Result<Vec<IfaceInfo>, NetError>);

impl Snapshot {
    fn take() -> Self {
        Snapshot(SystemNetwork.interfaces())
    }

    /// Network id of the first private interface with a default route (the one the QR points at).
    fn current_network_id(&self) -> Option<String> {
        self.0
            .as_ref()
            .ok()?
            .iter()
            .find(|i| {
                i.has_default_route
                    && i.category == NetCategory::Private
                    && ::lan_sync::hub::netpolicy::is_allowed_hub_addr(i.ip)
            })
            .and_then(|i| i.network_id.clone())
    }
}

impl NetworkInfo for Snapshot {
    fn interfaces(&self) -> Result<Vec<IfaceInfo>, NetError> {
        self.0.clone()
    }
}

fn unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| u64::try_from(d.as_millis()).unwrap_or(u64::MAX))
}

fn lan_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = crate::capture::app_data_folder(app)
        .ok_or("no-data-dir")?
        .join("lan-sync");
    std::fs::create_dir_all(&dir).map_err(|_| "no-data-dir")?;
    Ok(dir)
}

// ---- what the web app sees ----

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusDto {
    running: bool,
    /// `off`, `failed` or `listening`.
    state: &'static str,
    /// Why it is off (`nothing-wanted`, `unreadable`, `no-home`, `public-network`, `no-network`).
    reason: Option<&'static str>,
    /// The network category is "Public": Windows blocks incoming connections there.
    blocked: bool,
    port: Option<u16>,
    pairing_open: bool,
    /// The QR payload while a window is open and the hub is listening; renews itself silently.
    qr: Option<String>,
    pending: Option<PendingDto>,
    devices: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingDto {
    attempt: u64,
    /// Shown as plain text only (it is whatever the device claims).
    name: String,
    code: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataKeyDto {
    version: u32,
    /// base64 of the 32-byte key.
    key: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartDto {
    status: StatusDto,
    data_key: DataKeyDto,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceDto {
    id: String,
    name: String,
    last_seen: Option<u64>,
    revoked: bool,
}

fn reason_name(r: OffReason) -> &'static str {
    match r {
        OffReason::NothingWanted => "nothing-wanted",
        OffReason::NetworkUnreadable => "unreadable",
        OffReason::NoHomeNetwork => "no-home",
        OffReason::PublicNetwork => "public-network",
        OffReason::NoQualifyingInterface => "no-network",
    }
}

fn active_devices(trust: &FileTrustStore) -> usize {
    trust.list().iter().filter(|d| !d.revoked).count()
}

impl Core {
    fn status(&self) -> StatusDto {
        let live = self.live.lock();
        let Ok(live) = live else {
            return self.dto_off("unreadable");
        };
        let pairing_open = self.host.is_open();
        let (state, reason, blocked, port) = match &live.status {
            Status::Listening { port, .. } => ("listening", None, false, Some(*port)),
            Status::Failed => ("failed", None, false, None),
            Status::Off(r) => (
                "off",
                Some(reason_name(*r)),
                matches!(r, OffReason::PublicNetwork),
                None,
            ),
        };
        let qr = match (&live.status, pairing_open) {
            (Status::Listening { binds, port }, true) => binds
                .first()
                .and_then(|b| self.host.qr(*port, b.ip().octets()).ok().flatten()),
            _ => None,
        };
        StatusDto {
            running: true,
            state,
            reason,
            blocked,
            port,
            pairing_open,
            qr,
            pending: live.pending.clone().map(|p| PendingDto {
                attempt: p.attempt,
                name: p.name,
                code: p.code,
            }),
            devices: active_devices(&self.trust),
        }
    }

    fn dto_off(&self, reason: &'static str) -> StatusDto {
        StatusDto {
            running: true,
            state: "off",
            reason: Some(reason),
            blocked: false,
            port: None,
            pairing_open: false,
            qr: None,
            pending: None,
            devices: active_devices(&self.trust),
        }
    }

    /// One supervisor round: events, wish, network.
    fn round(&self) {
        self.host.tick();
        let snapshot = Snapshot::take();
        let Ok(mut live) = self.live.lock() else {
            return;
        };
        for event in self.host.take_events() {
            match event {
                PairingEvent::HelloReceived {
                    attempt,
                    name,
                    code,
                } => {
                    live.pending = Some(Pending {
                        attempt,
                        name,
                        code,
                    })
                }
                PairingEvent::Paired { .. } => {
                    live.pending = None;
                    // only the first pairing stores the home network
                    if let Some(id) = snapshot.current_network_id() {
                        let _ = self.home.set_if_empty(&id);
                    }
                }
                PairingEvent::Cancelled(_) | PairingEvent::Closed | PairingEvent::Expired => {
                    live.pending = None;
                }
                PairingEvent::Opened | PairingEvent::Renewed | PairingEvent::Burned { .. } => {}
            }
        }
        let wanted = Wanted {
            pairing_window_open: self.host.is_open(),
            paired_devices: active_devices(&self.trust),
        };
        let day = ::lan_sync::discovery::day_of(unix_ms() / 1000);
        let status = live.sup.tick(&snapshot, &self.home, wanted, day);
        live.status = status;
    }
}

impl Core {
    /// Closes the connection of the attempt waiting for a confirmation (cancel on the PC), so the
    /// device shows "Kopplung abgebrochen" at once. The hub lock is released before the transport
    /// is touched.
    fn end_waiting_connection(&self) {
        let found = self.live.lock().ok().and_then(|live| {
            let attempt = live.pending.as_ref().map(|p| p.attempt)?;
            let deliverer = live.sup.handle().and_then(Live::deliverer)?;
            Some((attempt, deliverer))
        });
        if let Some((attempt, deliverer)) = found {
            deliverer.abort(attempt);
        }
    }
}

fn build(app: &AppHandle) -> Result<(Arc<Core>, DataKeyDto), String> {
    let dir = lan_dir(app)?;
    let service = format!("{}.lan-sync", app.config().identifier);
    let slot = |name| KeyringSlot {
        service: service.clone(),
        name,
    };
    // keystore first: any error and nothing else is touched
    let key_store = SlotKeyStore::new(slot("hub-static-key"));
    let data_keys = DataKeys::new(slot("hub-data-key"));
    let data_key = data_keys
        .load_or_create()
        .map_err(|_| "keystore-unavailable")?;
    let key_dto = DataKeyDto {
        version: data_key.version,
        key: base64::engine::general_purpose::STANDARD.encode(&data_key.key[..]),
    };
    let hub_key = key_store
        .load_or_create()
        .map_err(|_| "keystore-unavailable")?
        .public();
    let trust =
        Arc::new(FileTrustStore::open(&dir.join("trust.json")).map_err(|_| "trust-unreadable")?);
    let sessions = Arc::new(SessionRegistry::new());
    let store =
        Store::open(&dir.join("hub.db").to_string_lossy()).map_err(|_| "store-unavailable")?;
    let hub = Arc::new(Hub::new(store, data_key.version, sessions.clone()));
    let host = Arc::new(PairingHost::new(
        hub_key,
        Arc::new(SystemClock::new()),
        trust.clone(),
        Arc::new(DataKeys::new(slot("hub-data-key"))),
    ));
    let endpoint = Endpoint::start(&key_store, trust.clone(), host.clone(), sessions.clone())
        .map_err(|_| "keystore-unavailable")?;
    let router = Arc::new(Router::new(
        endpoint,
        host.clone(),
        hub.clone(),
        Admission::new(),
    ));
    let launcher = RealLauncher {
        router,
        hub_key: PublicKey::from_bytes(*hub_key.as_bytes()),
        cfg: ServerConfig::default(),
    };
    let core = Arc::new(Core {
        hub,
        host,
        trust,
        sessions,
        data_keys,
        home: FileHomeNetwork::new(&dir.join("home.json")),
        live: Mutex::new(LiveState {
            sup: Supervisor::new(launcher),
            status: Status::Off(OffReason::NothingWanted),
            pending: None,
        }),
    });
    Ok((core, key_dto))
}

fn with_core<T>(
    state: &State<'_, LanSync>,
    f: impl FnOnce(&Arc<Core>, &Sender<()>) -> Result<T, String>,
) -> Result<T, String> {
    let slot = state.0.lock().map_err(|_| "internal")?;
    let running = slot.as_ref().ok_or("not-started")?;
    f(&running.core, &running.wake)
}

// ---- commands ----

/// Starts the hub (idempotent). Fails, and starts nothing, if the keystore does not answer.
#[tauri::command]
pub fn lan_hub_start(app: AppHandle, state: State<'_, LanSync>) -> Result<StartDto, String> {
    let mut slot = state.0.lock().map_err(|_| "internal")?;
    if let Some(r) = slot.as_ref() {
        let dk = r
            .core
            .data_keys
            .load_or_create()
            .map_err(|_| "keystore-unavailable")?;
        return Ok(StartDto {
            status: r.core.status(),
            data_key: DataKeyDto {
                version: dk.version,
                key: base64::engine::general_purpose::STANDARD.encode(&dk.key[..]),
            },
        });
    }
    let (core, data_key) = build(&app)?;
    let stop = Arc::new(AtomicBool::new(false));
    let (wake, rx) = mpsc::channel::<()>();
    let thread = {
        let core = core.clone();
        let stop = stop.clone();
        std::thread::Builder::new()
            .name("lan-sync-supervisor".into())
            .spawn(move || {
                while !stop.load(Ordering::SeqCst) {
                    core.round();
                    let _ = rx.recv_timeout(TICK);
                }
            })
            .map_err(|_| "internal")?
    };
    core.round();
    let status = core.status();
    *slot = Some(Running {
        core,
        stop,
        wake,
        thread: Some(thread),
    });
    Ok(StartDto { status, data_key })
}

/// Stops listening and closes every connection; the keys and the trust list stay.
#[tauri::command]
pub fn lan_hub_stop(state: State<'_, LanSync>) -> Result<(), String> {
    let running = state.0.lock().map_err(|_| "internal")?.take();
    if let Some(mut r) = running {
        r.stop.store(true, Ordering::SeqCst);
        let _ = r.wake.send(());
        if let Some(t) = r.thread.take() {
            let _ = t.join();
        }
        r.core.host.cancel();
        if let Ok(mut live) = r.core.live.lock() {
            live.sup.stop();
        }
        r.core.sessions.close_all().map_err(|_| "internal")?;
    }
    Ok(())
}

#[tauri::command]
pub fn lan_hub_status(state: State<'_, LanSync>) -> StatusDto {
    match state.0.lock() {
        Ok(slot) => match slot.as_ref() {
            Some(r) => r.core.status(),
            None => StatusDto {
                running: false,
                state: "off",
                reason: None,
                blocked: false,
                port: None,
                pairing_open: false,
                qr: None,
                pending: None,
                devices: 0,
            },
        },
        Err(_) => StatusDto {
            running: false,
            state: "off",
            reason: Some("unreadable"),
            blocked: false,
            port: None,
            pairing_open: false,
            qr: None,
            pending: None,
            devices: 0,
        },
    }
}

/// Opens the pairing window; the QR shows up in `lan_hub_status` as soon as the hub listens.
#[tauri::command]
pub fn lan_pair_open(state: State<'_, LanSync>) -> Result<(), String> {
    with_core(&state, |core, wake| {
        core.host.open().map_err(|_| "busy".to_owned())?;
        let _ = wake.send(());
        Ok(())
    })
}

/// The user confirmed the code shown on the PC. The sealed data-key frame goes only to the
/// connection of that attempt, and the device is trusted only if that write succeeded.
#[tauri::command]
pub fn lan_pair_confirm(
    state: State<'_, LanSync>,
    attempt: u64,
    code: String,
) -> Result<(), String> {
    with_core(&state, |core, wake| {
        // the hub lock is not held while the frame is written: take the handle, let go, then confirm
        let deliverer = core
            .live
            .lock()
            .map_err(|_| "internal")?
            .sup
            .handle()
            .and_then(Live::deliverer)
            .ok_or("no-connection")?;
        let result = core
            .host
            .confirm_deliver(attempt, &code, &mut |wire| deliverer.deliver(attempt, wire));
        if result.is_err() {
            // a wrong code or a lost attempt: the device must not wait for its own timeout
            deliverer.abort(attempt);
        }
        let _ = wake.send(());
        result.map_err(|e| match e {
            PairError::WrongCode => "wrong-code",
            PairError::Expired => "expired",
            PairError::NotAwaiting | PairError::WrongAttempt => "not-awaiting",
            PairError::Delivery => "no-connection",
            _ => "failed",
        })?;
        Ok(())
    })
}

#[tauri::command]
pub fn lan_pair_cancel(state: State<'_, LanSync>) -> Result<(), String> {
    with_core(&state, |core, wake| {
        core.host.cancel();
        core.end_waiting_connection();
        let _ = wake.send(());
        Ok(())
    })
}

#[tauri::command]
pub fn lan_devices(state: State<'_, LanSync>) -> Result<Vec<DeviceDto>, String> {
    with_core(&state, |core, _| {
        Ok(core
            .trust
            .list()
            .into_iter()
            .map(|d: Device| DeviceDto {
                id: to_hex(d.key.as_bytes()),
                name: d.name,
                last_seen: d.last_seen,
                revoked: d.revoked,
            })
            .collect())
    })
}

/// Unpairs a device and closes its open connections at once.
#[tauri::command]
pub fn lan_revoke(state: State<'_, LanSync>, id: String) -> Result<bool, String> {
    with_core(&state, |core, wake| {
        let key = from_hex32(&id).ok_or("bad-id")?;
        let changed = core
            .sessions
            .revoke(&*core.trust, &PublicKey::from_bytes(key))
            .map_err(|_| "failed")?;
        let _ = wake.send(());
        Ok(changed)
    })
}

/// "Schlüssel erneuern": a new data key version, the store is emptied (new epoch), every open
/// connection ends. The new key goes to the web app; devices must pair again.
#[tauri::command]
pub fn lan_hub_rotate(state: State<'_, LanSync>) -> Result<DataKeyDto, String> {
    with_core(&state, |core, wake| {
        let old = core
            .data_keys
            .load_or_create()
            .map_err(|_| "keystore-unavailable")?;
        let new = core
            .data_keys
            .rotate()
            .map_err(|_| "keystore-unavailable")?;
        if core.hub.rotate_to(new.version).is_err() {
            // the hub kept its old version and data: put the old key back, and say so if that fails
            return Err(match core.data_keys.restore(&old) {
                Ok(()) => "rotate-failed".to_owned(),
                Err(_) => "rotate-failed-keystore".to_owned(),
            });
        }
        let _ = wake.send(());
        Ok(DataKeyDto {
            version: new.version,
            key: base64::engine::general_purpose::STANDARD.encode(&new.key[..]),
        })
    })
}

/// The hub-local client's requests (in process, same JSON as remote clients, see `handler.rs`).
/// Body and answer are JSON text; neither is ever logged.
#[tauri::command]
pub fn lan_hub_request(state: State<'_, LanSync>, body: String) -> Result<String, String> {
    with_core(&state, |core, _| {
        let answer = core.hub.handle_json(body.as_bytes(), unix_ms());
        String::from_utf8(answer).map_err(|_| "internal".to_owned())
    })
}

/// "Dieses Netz als Heimnetz verwenden": the network the PC is in now replaces the stored one. The
/// web app asks for confirmation first.
#[tauri::command]
pub fn lan_home_set(state: State<'_, LanSync>) -> Result<(), String> {
    with_core(&state, |core, wake| {
        let id = Snapshot::take().current_network_id().ok_or("no-network")?;
        core.home.set(&id).map_err(|_| "failed")?;
        let _ = wake.send(());
        Ok(())
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_off_reason_has_a_stable_name() {
        for (r, n) in [
            (OffReason::NothingWanted, "nothing-wanted"),
            (OffReason::NetworkUnreadable, "unreadable"),
            (OffReason::NoHomeNetwork, "no-home"),
            (OffReason::PublicNetwork, "public-network"),
            (OffReason::NoQualifyingInterface, "no-network"),
        ] {
            assert_eq!(reason_name(r), n);
        }
    }

    #[test]
    fn the_snapshot_never_names_a_network_it_cannot_see() {
        assert_eq!(Snapshot(Err(NetError)).current_network_id(), None);
        let none = Snapshot(Ok(vec![]));
        assert_eq!(none.current_network_id(), None);
    }

    #[test]
    fn the_snapshot_picks_the_private_default_route_network() {
        let iface = |ip: &str, route: bool, cat: NetCategory, id: &str| IfaceInfo {
            ip: ip.parse().unwrap(),
            prefix: 24,
            has_default_route: route,
            category: cat,
            network_id: Some(id.into()),
        };
        let s = Snapshot(Ok(vec![
            iface("172.20.0.1", false, NetCategory::Private, "wsl"),
            iface("203.0.113.9", true, NetCategory::Public, "vpn"),
            iface("192.168.1.20", true, NetCategory::Private, "home"),
        ]));
        assert_eq!(s.current_network_id().as_deref(), Some("home"));
    }
}
