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

/// "Alle Daten löschen": no hub starts while the wipe runs ([`WIPE_RUNNING`], an upper bound in
/// case it never reports its end) and for [`WIPE_HOLD`] after it ended – a sync round of the page
/// that still has its database until the reload must not build new keys and a new `lan-sync/`.
const WIPE_RUNNING: Duration = Duration::from_secs(3600);
const WIPE_HOLD: Duration = Duration::from_secs(60);

/// The hub, and until when no hub may start (set by the wipe).
#[derive(Default)]
pub struct LanSync(Mutex<Option<Running>>, Mutex<Option<std::time::Instant>>);

impl LanSync {
    /// The hub is started (listening or waiting for a network); a poisoned lock counts as running,
    /// so a client pairing is refused rather than allowed beside a hub.
    pub fn is_running(&self) -> bool {
        self.0.lock().map_or(true, |slot| slot.is_some())
    }
}

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
    /// Remote control: the PC's own controls and the sink the input session acts through.
    remote: Arc<::lan_sync::input::Remote>,
    sink: Arc<crate::remote::Sink>,
    /// Device exchange: wired on every desktop, its switch decides (`crate::exchange`).
    exchange: Arc<::lan_sync::exchange::Exchange>,
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
    let dir = lan_dir_path(app).ok_or("no-data-dir")?;
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
    let key_store = SlotKeyStore::new(slot(KEY_SLOTS[0]));
    let data_keys = DataKeys::new(slot(KEY_SLOTS[1]));
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
        Arc::new(DataKeys::new(slot(KEY_SLOTS[1]))),
    ));
    let endpoint = Endpoint::start(&key_store, trust.clone(), host.clone(), sessions.clone())
        .map_err(|_| "keystore-unavailable")?;
    // Remote control is wired on every desktop; where the system cannot be controlled the sink
    // says so and every `open` is answered `unsupported`.
    let (remote, sink) = {
        use tauri::Manager as _;
        crate::remote::parts(
            &dir,
            trust.clone(),
            &app.state::<crate::remote::RemoteHost>(),
        )
    };
    // Device exchange is wired on every desktop too: a phone whose PC has it off hears
    // `exchange-off`, never "unknown device".
    let exchange = crate::exchange::parts(app, &dir, trust.clone());
    let router = Arc::new(
        Router::new(endpoint, host.clone(), hub.clone(), Admission::new())
            .with_input(remote.clone(), sink.clone())
            .with_exchange(exchange.clone()),
    );
    let launcher = RealLauncher::new(
        router,
        PublicKey::from_bytes(*hub_key.as_bytes()),
        ServerConfig::default(),
        // the same port across restarts: paired phones only know the address of the QR
        Some(dir.join("port")),
    );
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
        remote,
        sink,
        exchange,
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
//
// All of them run with `async` (Tauri's async runtime, not the main thread): starting, stopping,
// rotating and the hub-local sync requests touch the keystore, the store file and the network, and
// every command waits for the same `LanSync` lock, so a quick one on the main thread would wait for a
// slow one. The lock keeps them one at a time, as before. `tests/commands.rs` pins this.

/// Starts the hub (idempotent). Fails, and starts nothing, if the keystore does not answer.
#[tauri::command(async)]
pub fn lan_hub_start(app: AppHandle, state: State<'_, LanSync>) -> Result<StartDto, String> {
    let mut slot = state.0.lock().map_err(|_| "internal")?;
    if held(&state.1, std::time::Instant::now()) {
        return Err("wiped".to_owned());
    }
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
    // one path per device: a PC paired with another hub PC never becomes a hub itself
    if crate::lan_client::is_paired(&app) {
        return Err("client-paired".to_owned());
    }
    let (core, data_key) = build(&app)?;
    // The PC's own controls (end, switch off, the tray) are reachable before anything can listen:
    // a session that opens in the hub's first moment can be ended like any other.
    {
        crate::remote::attach(
            &app,
            core.remote.clone(),
            core.trust.clone(),
            core.sink.clone(),
            core.sessions.clone(),
        );
        crate::exchange::attach(
            &app,
            core.exchange.clone(),
            core.trust.clone(),
            core.remote.clone(),
        );
    }
    let stop = Arc::new(AtomicBool::new(false));
    let (wake, rx) = mpsc::channel::<()>();
    let thread = {
        let core = core.clone();
        let stop = stop.clone();
        let spawned = std::thread::Builder::new()
            .name("lan-sync-supervisor".into())
            .spawn(move || {
                while !stop.load(Ordering::SeqCst) {
                    core.round();
                    let _ = rx.recv_timeout(TICK);
                }
            });
        match spawned {
            Ok(thread) => thread,
            Err(_) => {
                // nothing listens: the controls go again
                crate::remote::detach(&app);
                crate::exchange::detach(&app);
                return Err("internal".to_owned());
            }
        }
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
#[tauri::command(async)]
pub fn lan_hub_stop(app: AppHandle, state: State<'_, LanSync>) -> Result<(), String> {
    // The lock is held until the hub is down: `lan_hub_start` on another thread must not build a
    // second hub (same port, same store file) while this one still closes.
    let mut slot = state.0.lock().map_err(|_| "internal")?;
    if let Some(mut r) = slot.take() {
        // first of all: no countdown may run out while the hub is going down
        {
            use tauri::Manager as _;
            app.state::<crate::remote::RemoteHost>().power().detach();
        }
        r.stop.store(true, Ordering::SeqCst);
        let _ = r.wake.send(());
        if let Some(t) = r.thread.take() {
            let _ = t.join();
        }
        r.core.host.cancel();
        if let Ok(mut live) = r.core.live.lock() {
            live.sup.stop();
        }
        // Sessions first (an input session ends with them), then the PC's remote controls and
        // the tray – whatever closing said, so nothing is left pointing at a stopped hub.
        let closed = r.core.sessions.close_all();
        crate::remote::detach(&app);
        crate::exchange::detach(&app);
        closed.map_err(|_| "internal")?;
    }
    Ok(())
}

// ---- "Alle Daten löschen" ----

/// Names of the hub's two keystore entries (service `<identifier>.lan-sync`): static key, data key.
/// `build` creates them under these names, the wipe deletes the same.
const KEY_SLOTS: [&str; 2] = ["hub-static-key", "hub-data-key"];

/// What wiping the hub needs from the running app; a trait so the order is tested without an
/// `AppHandle` (the real one is [`AppHub`]).
pub(crate) trait HubWipe {
    /// Listener down, every session (sync, input, exchange) closed, the PC's controls detached.
    fn stop(&self) -> Result<(), ()>;
    /// Removes one keystore entry; an entry that is not there counts as removed.
    fn delete_key(&self, name: &str) -> Result<(), ()>;
    /// Drops what the run keeps in memory beside the files (exchange boxes, program list); last,
    /// so nothing reopened from the old files in between stays cached.
    fn forget_run_state(&self);
}

/// Stops the hub, then removes both keystore entries and the whole `lan-sync/` folder (trust list,
/// `hub.db`, home network, port, remote-control and exchange grants, program list, exchange
/// boxes). Every step runs even when an earlier one failed; `Err` if any did. Takes no path from
/// the web view: `dir` comes from the app's own data folder.
pub(crate) fn wipe_hub(hub: &impl HubWipe, dir: Option<&std::path::Path>) -> Result<(), ()> {
    let mut ok = hub.stop().is_ok();
    for name in KEY_SLOTS {
        ok &= hub.delete_key(name).is_ok();
    }
    if let Some(dir) = dir {
        ok &= match std::fs::remove_dir_all(dir) {
            Ok(()) => true,
            Err(e) => e.kind() == std::io::ErrorKind::NotFound,
        };
    }
    hub.forget_run_state();
    ok.then_some(()).ok_or(())
}

/// True while no hub may start; a poisoned lock counts as held.
fn held(until: &Mutex<Option<std::time::Instant>>, now: std::time::Instant) -> bool {
    until
        .lock()
        .map_or(true, |until| until.is_some_and(|t| now < t))
}

fn hold_until(until: &Mutex<Option<std::time::Instant>>, t: std::time::Instant) {
    let mut slot = until.lock().unwrap_or_else(|e| e.into_inner());
    *slot = Some(t);
}

/// End of the wipe (`crate::device_wipe`): the hold now lasts [`WIPE_HOLD`] from here.
pub(crate) fn wipe_finished(app: &AppHandle) {
    use tauri::Manager as _;
    hold_until(
        &app.state::<LanSync>().1,
        std::time::Instant::now() + WIPE_HOLD,
    );
}

pub(crate) struct AppHub<'a>(pub &'a AppHandle);

impl HubWipe for AppHub<'_> {
    fn stop(&self) -> Result<(), ()> {
        use tauri::Manager as _;
        let state = self.0.state::<LanSync>();
        // first: a start waiting for the lock (a sync round) must not rebuild the hub afterwards
        hold_until(&state.1, std::time::Instant::now() + WIPE_RUNNING);
        // the command itself (also used by "Ausschalten"), so both stop the hub the same way
        lan_hub_stop(self.0.clone(), state).map_err(|_| ())
    }

    fn forget_run_state(&self) {
        use tauri::Manager as _;
        self.0
            .state::<crate::exchange::ExchangeHost>()
            .forget_files();
        self.0
            .state::<crate::remote::RemoteHost>()
            .forget_programs();
    }

    fn delete_key(&self, name: &str) -> Result<(), ()> {
        let entry = keyring::Entry::new(&format!("{}.lan-sync", self.0.config().identifier), name)
            .map_err(|_| ())?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err(()),
        }
    }
}

/// The hub's folder, without creating it.
pub(crate) fn lan_dir_path(app: &AppHandle) -> Option<PathBuf> {
    crate::capture::app_data_folder(app).map(|d| d.join("lan-sync"))
}

#[tauri::command(async)]
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
#[tauri::command(async)]
pub fn lan_pair_open(state: State<'_, LanSync>) -> Result<(), String> {
    with_core(&state, |core, wake| {
        core.host.open().map_err(|_| "busy".to_owned())?;
        let _ = wake.send(());
        Ok(())
    })
}

/// "Koppeln" on the page. H6: the page cannot confirm by itself – Rust asks in a native question
/// (name and code of the waiting attempt, cancel is the default) and confirms with its own copy
/// of the code. The sealed data-key frame goes only to the connection of that attempt, and the
/// device is trusted only if that write succeeded.
#[tauri::command(async)]
pub fn lan_pair_confirm(
    app: AppHandle,
    state: State<'_, LanSync>,
    attempt: u64,
) -> Result<(), String> {
    let waiting = |state: &State<'_, LanSync>| {
        with_core(state, |core, _| {
            let live = core.live.lock().map_err(|_| "internal")?;
            Ok(live.pending.clone().filter(|p| p.attempt == attempt))
        })
    };
    let pending = waiting(&state)?.ok_or("not-awaiting")?;
    // Like every widening question: never while a phone controls mouse and keyboard (it could
    // click the answer), checked again after it; one question at a time.
    let remote = with_core(&state, |core, _| Ok(core.remote.clone()))?;
    let ticket = remote.ticket();
    if remote.full_session_open() {
        return Err("busy-controlled".to_owned());
    }
    if PAIR_ASKING.swap(true, std::sync::atomic::Ordering::SeqCst) {
        return Err("busy".to_owned());
    }
    let allowed = asked_to_pair(&app, &pending);
    PAIR_ASKING.store(false, std::sync::atomic::Ordering::SeqCst);
    if !allowed {
        return Err("cancelled".to_owned());
    }
    remote
        .confirm(ticket)
        .map_err(|_| "busy-controlled".to_owned())?;
    // the attempt may have ended while the question was on screen (the attempt id is unique)
    waiting(&state)?.ok_or("not-awaiting")?;
    let code = pending.code;
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
            // a wrong code or a lost attempt: neither device may wait for its own timeout (the id the
            // UI passed, and the attempt the hub still showed as waiting)
            deliverer.abort(attempt);
            core.end_waiting_connection();
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

/// A pairing question is on screen (one at a time).
static PAIR_ASKING: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// The native pairing question; true only for the exact "pair" button.
fn asked_to_pair(app: &AppHandle, pending: &Pending) -> bool {
    let lang = crate::capture::native_lang(app);
    let (title, allow, cancel) = crate::texts::pair_dialog(lang);
    let name = match crate::remote::plain(&pending.name) {
        n if n.is_empty() => crate::texts::exchange_unnamed(lang).to_owned(),
        n => n,
    };
    let text = crate::texts::pair_question(lang, &name, &pending.code);
    crate::native_ask::ask(app, title, text, false, allow, cancel)
}

#[tauri::command(async)]
pub fn lan_pair_cancel(state: State<'_, LanSync>) -> Result<(), String> {
    with_core(&state, |core, wake| {
        // the waiting attempt is read before the window closes (a supervisor round clears it after)
        core.end_waiting_connection();
        core.host.cancel();
        let _ = wake.send(());
        Ok(())
    })
}

#[tauri::command(async)]
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
#[tauri::command(async)]
pub fn lan_revoke(app: AppHandle, state: State<'_, LanSync>, id: String) -> Result<bool, String> {
    with_core(&state, |core, wake| {
        let key = from_hex32(&id).ok_or("bad-id")?;
        let result = core
            .sessions
            .revoke(&*core.trust, &PublicKey::from_bytes(key));
        // what this PC queued for it goes too – also when the revoke could not be written (H5):
        // in memory it is revoked already
        let active: Vec<PublicKey> = core
            .trust
            .list()
            .into_iter()
            .filter(|d| !d.revoked)
            .map(|d| d.key)
            .collect();
        crate::exchange::keep_only(&app, &active);
        let _ = wake.send(());
        result.map_err(|_| "failed".to_owned())
    })
}

/// "Schlüssel erneuern": a new data key version, the store is emptied (new epoch), every open
/// connection ends. The new key goes to the web app; devices must pair again.
#[tauri::command(async)]
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
#[tauri::command(async)]
pub fn lan_hub_request(state: State<'_, LanSync>, body: String) -> Result<String, String> {
    with_core(&state, |core, _| {
        let answer = core.hub.handle_json(body.as_bytes(), unix_ms());
        String::from_utf8(answer).map_err(|_| "internal".to_owned())
    })
}

/// "Dieses Netz als Heimnetz verwenden": the network the PC is in now replaces the stored one. The
/// web app asks for confirmation first.
#[tauri::command(async)]
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

    /// A hub as the wipe sees it: a listener flag, a keystore and a log of the calls.
    struct FakeHub {
        listening: std::cell::Cell<bool>,
        keys: std::cell::RefCell<Vec<String>>,
        calls: std::cell::RefCell<Vec<String>>,
        stop_fails: bool,
        key_fails: bool,
    }

    impl FakeHub {
        fn running() -> Self {
            FakeHub {
                listening: true.into(),
                keys: KEY_SLOTS
                    .iter()
                    .map(|k| k.to_string())
                    .collect::<Vec<_>>()
                    .into(),
                calls: Vec::new().into(),
                stop_fails: false,
                key_fails: false,
            }
        }
    }

    impl HubWipe for FakeHub {
        fn stop(&self) -> Result<(), ()> {
            self.calls.borrow_mut().push("stop".into());
            if self.stop_fails {
                return Err(());
            }
            self.listening.set(false);
            Ok(())
        }
        fn delete_key(&self, name: &str) -> Result<(), ()> {
            self.calls.borrow_mut().push(format!("key:{name}"));
            if self.key_fails {
                return Err(());
            }
            self.keys.borrow_mut().retain(|k| k != name);
            Ok(())
        }
        fn forget_run_state(&self) {
            self.calls.borrow_mut().push("forget".into());
        }
    }

    fn temp_root(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("nemo-wipe-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    fn hub_folder(name: &str) -> PathBuf {
        let root = temp_root(name);
        let dir = root.join("lan-sync");
        std::fs::create_dir_all(dir.join("exchange")).unwrap();
        for f in [
            "trust.json",
            "hub.db",
            "home.json",
            "port",
            "remote.json",
            "remote-programs.json",
        ] {
            std::fs::write(dir.join(f), b"x").unwrap();
        }
        std::fs::write(dir.join("exchange").join("inbox.json"), b"x").unwrap();
        dir
    }

    #[test]
    fn the_wipe_stops_the_listener_first_then_removes_keys_and_folder() {
        let dir = hub_folder("order");
        let hub = FakeHub::running();
        assert_eq!(wipe_hub(&hub, Some(&dir)), Ok(()));
        assert!(!hub.listening.get(), "nothing listens after the wipe");
        assert!(hub.keys.borrow().is_empty(), "both keystore entries gone");
        assert!(
            !dir.exists(),
            "trust list, hub.db, grants and exchange gone"
        );
        assert_eq!(
            hub.calls.borrow().as_slice(),
            ["stop", "key:hub-static-key", "key:hub-data-key", "forget"]
        );
    }

    #[test]
    fn a_failing_step_does_not_stop_the_others() {
        let dir = hub_folder("stop-fails");
        let hub = FakeHub {
            stop_fails: true,
            ..FakeHub::running()
        };
        assert_eq!(wipe_hub(&hub, Some(&dir)), Err(()));
        assert!(hub.keys.borrow().is_empty());
        assert!(!dir.exists());

        let dir = hub_folder("key-fails");
        let hub = FakeHub {
            key_fails: true,
            ..FakeHub::running()
        };
        assert_eq!(wipe_hub(&hub, Some(&dir)), Err(()));
        assert!(!hub.listening.get());
        assert!(!dir.exists());
    }

    #[test]
    fn a_missing_folder_is_no_error() {
        let root = temp_root("missing");
        let hub = FakeHub::running();
        assert_eq!(wipe_hub(&hub, Some(&root.join("lan-sync"))), Ok(()));
    }

    #[test]
    fn no_hub_starts_while_the_wipe_runs_and_a_minute_after() {
        let until = Mutex::new(None);
        let t0 = std::time::Instant::now();
        assert!(!held(&until, t0));
        hold_until(&until, t0 + WIPE_RUNNING); // the wipe started
        assert!(
            held(&until, t0 + Duration::from_secs(300)),
            "a slow wipe still holds"
        );
        let end = t0 + Duration::from_secs(40);
        hold_until(&until, end + WIPE_HOLD); // the wipe ended
        assert!(held(&until, end + Duration::from_secs(59)));
        assert!(!held(&until, end + WIPE_HOLD));
    }
}
