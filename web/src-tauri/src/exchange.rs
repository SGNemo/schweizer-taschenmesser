//! Device exchange on the PC (concept `docs/design/device-exchange/CONCEPT.md`): the hub's
//! exchange side is wired on every desktop and the switch decides, so a device whose PC has the
//! module off hears `exchange-off`, never "unknown device".
//!
//! * Files in `<app data>/lan-sync/exchange/`: `switch.json` (module on at this PC), `inbox.json`,
//!   `outbox.json` (`crate::exchange_store`). The grant per device lives in `trust.json`.
//! * Writers: `exchange_set_enabled` and `exchange_set_device`. A widening (the switch on while a
//!   grant is stored, a device on, un-pausing) is asked in a native dialog and refused while a
//!   mouse/keyboard remote session is open (that phone could click the dialog). Narrowing is
//!   immediate. No frame from the network reaches them.
//! * The web view takes received items over (`exchange_take`, then `exchange_confirm`) and hears
//!   `exchange://changed` (no payload) when something arrived or a device answered.
//!
//! Nothing here logs: no text, link, name or size.

use crate::exchange_store::{
    hex, id_from_hex, kind_from, unix_ms, Answer, Entry, Inbox, Key, Outbox,
};
use crate::texts::{self, Lang};
use lan_sync::exchange::control::Stored;
use lan_sync::exchange::wire::{AckState, Item};
use lan_sync::exchange::{Exchange, ExchangeInbox, ExchangeOutbox, InboxFull};
use lan_sync::input::{FileSwitch, MasterSwitch, Remote};
use lan_sync::noise::PublicKey;
use lan_sync::trust::{ExchangeGrant, FileTrustStore, TrustStore};
use serde::Serialize;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter as _, Manager as _, State};
use tauri_plugin_dialog::{DialogExt as _, MessageDialogButtons, MessageDialogKind};

const CHANGED: &str = "exchange://changed";

/// Managed state: inbox and outbox (they outlive a hub restart) and the running hub's parts.
#[derive(Default)]
pub struct ExchangeHost {
    files: Mutex<Option<(Arc<Inbox>, Arc<Outbox>)>>,
    slot: Mutex<Option<Parts>>,
    /// A confirmation is on screen; a second one is refused instead of stacked.
    asking: AtomicBool,
}

#[derive(Clone)]
struct Parts {
    exchange: Arc<Exchange>,
    trust: Arc<FileTrustStore>,
    remote: Arc<Remote>,
}

/// A switch that cannot be read is off and cannot be set (fail-closed).
struct ClosedSwitch;

impl MasterSwitch for ClosedSwitch {
    fn enabled(&self) -> bool {
        false
    }
    fn set(&self, _on: bool) -> Result<(), lan_sync::input::remote::SwitchError> {
        Err(lan_sync::input::remote::SwitchError)
    }
}

struct HubInbox {
    inbox: Arc<Inbox>,
    app: AppHandle,
}

impl ExchangeInbox for HubInbox {
    fn store(&self, from: &PublicKey, item: &Item) -> Result<Stored, InboxFull> {
        match self.inbox.store(&hex(from.as_bytes()), item, unix_ms()) {
            Ok(crate::exchange_store::StoreResult::New) => {
                let _ = self.app.emit(CHANGED, ());
                Ok(Stored::New)
            }
            Ok(crate::exchange_store::StoreResult::Known) => Ok(Stored::Known),
            Err(_) => Err(InboxFull),
        }
    }
}

struct HubOutbox {
    outbox: Arc<Outbox>,
    app: AppHandle,
}

impl ExchangeOutbox for HubOutbox {
    fn next(&self, to: &PublicKey) -> Option<Item> {
        self.outbox.next_for(&hex(to.as_bytes()))
    }
    fn answered(&self, to: &PublicKey, id: &[u8; 16], state: AckState) {
        self.outbox.answer(&hex(to.as_bytes()), id, state);
        let _ = self.app.emit(CHANGED, ());
    }
}

/// `<app data>/lan-sync/exchange` (the hub's folder; the files outlive a hub that is off).
fn exchange_dir(app: &AppHandle) -> Option<std::path::PathBuf> {
    let dir = crate::capture::app_data_folder(app)?
        .join("lan-sync")
        .join("exchange");
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir)
}

impl ExchangeHost {
    /// Inbox and outbox, opened once from the app's data folder – whether the hub runs or not.
    /// One pair per run: two in-memory copies of a file would overwrite each other.
    fn files(&self, app: &AppHandle) -> Option<(Arc<Inbox>, Arc<Outbox>)> {
        self.files_in(exchange_dir(app))
    }

    fn files_in(&self, dir: Option<std::path::PathBuf>) -> Option<(Arc<Inbox>, Arc<Outbox>)> {
        let mut files = match self.files.lock() {
            Ok(f) => f,
            Err(p) => p.into_inner(),
        };
        if files.is_none() {
            let dir = dir?;
            *files = Some((
                Arc::new(Inbox::open(&dir.join("inbox.json"))),
                Arc::new(Outbox::open(&dir.join("outbox.json"))),
            ));
        }
        files.clone()
    }

    fn parts(&self) -> Result<Parts, String> {
        let slot = self.slot.lock().map_err(|_| "internal")?;
        Ok(slot.as_ref().ok_or("not-started")?.clone())
    }
}

fn switch_at(dir: &Path) -> Arc<dyn MasterSwitch> {
    match FileSwitch::open(&dir.join("switch.json")) {
        Ok(s) => Arc::new(s),
        Err(_) => Arc::new(ClosedSwitch),
    }
}

/// The hub's exchange side, built where the hub is built (`lan_sync::build`).
pub fn parts(app: &AppHandle, lan_dir: &Path, trust: Arc<FileTrustStore>) -> Arc<Exchange> {
    let dir = lan_dir.join("exchange");
    let _ = std::fs::create_dir_all(&dir);
    let host = app.state::<ExchangeHost>();
    let (inbox, outbox) = match host.files(app).or_else(|| host.files_in(Some(dir.clone()))) {
        Some(files) => files,
        None => (
            Arc::new(Inbox::open(&dir.join("inbox.json"))),
            Arc::new(Outbox::open(&dir.join("outbox.json"))),
        ),
    };
    // queues of devices that are no longer paired go
    let active: Vec<String> = trust
        .list()
        .into_iter()
        .filter(|d| !d.revoked)
        .map(|d| hex(d.key.as_bytes()))
        .collect();
    outbox.keep_only(&active);
    let switch = switch_at(&dir);
    Arc::new(Exchange::new(
        switch,
        trust,
        Arc::new(HubInbox {
            inbox,
            app: app.clone(),
        }),
        Arc::new(HubOutbox {
            outbox,
            app: app.clone(),
        }),
    ))
}

/// The PC's controls reach the running hub.
pub fn attach(
    app: &AppHandle,
    exchange: Arc<Exchange>,
    trust: Arc<FileTrustStore>,
    remote: Arc<Remote>,
) {
    if let Ok(mut slot) = app.state::<ExchangeHost>().slot.lock() {
        *slot = Some(Parts {
            exchange,
            trust,
            remote,
        });
    }
}

pub fn detach(app: &AppHandle) {
    if let Ok(mut slot) = app.state::<ExchangeHost>().slot.lock() {
        *slot = None;
    }
}

/// Devices were unpaired (or the key renewed): only the queues of `active` devices stay.
pub fn keep_only(app: &AppHandle, active: &[PublicKey]) {
    if let Some((_, outbox)) = app.state::<ExchangeHost>().files(app) {
        let keep: Vec<String> = active.iter().map(|k| hex(k.as_bytes())).collect();
        outbox.keep_only(&keep);
    }
}

/// Unicode format characters (bidi controls, zero-width characters, BOM, soft hyphen …).
fn is_format(c: char) -> bool {
    matches!(c,
        '\u{00AD}' | '\u{061C}' | '\u{180E}' | '\u{200B}'..='\u{200F}' | '\u{202A}'..='\u{202E}'
        | '\u{2060}'..='\u{2064}' | '\u{2066}'..='\u{206F}' | '\u{FEFF}' | '\u{FFF9}'..='\u{FFFB}')
}

/// Plain text for a dialog: no control or format characters from a device name.
fn plain(name: &str) -> String {
    name.chars()
        .filter(|c| !c.is_control() && !is_format(*c))
        .take(64)
        .collect::<String>()
        .trim()
        .to_owned()
}

fn shown_name(lang: Lang, name: &str) -> String {
    let name = plain(name);
    if name.is_empty() {
        texts::exchange_unnamed(lang).to_owned()
    } else {
        name
    }
}

fn confirmed(app: &AppHandle, lang: Lang, names: &str) -> bool {
    let (title, allow, cancel) = texts::exchange_dialog(lang);
    let mut dialog = app
        .dialog()
        .message(texts::exchange_question(lang, names))
        .title(title)
        .kind(MessageDialogKind::Info)
        .buttons(MessageDialogButtons::OkCancelCustom(
            allow.into(),
            cancel.into(),
        ));
    if let Some(window) = app.get_webview_window("main") {
        dialog = dialog.parent(&window);
    }
    dialog.blocking_show()
}

/// Takes the "a question is on screen" flag; refused while another one is.
struct Asking<'a>(&'a AtomicBool);

impl<'a> Asking<'a> {
    fn take(flag: &'a AtomicBool) -> Result<Self, String> {
        if flag.swap(true, Ordering::SeqCst) {
            return Err("asking".to_owned());
        }
        Ok(Asking(flag))
    }
}

impl Drop for Asking<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

// ---- what the web view sees ----

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceDto {
    id: String,
    name: String,
    /// Unix seconds of the last sync contact.
    last_seen: Option<u64>,
    on: bool,
    paused: bool,
    connected: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueuedDto {
    peer: String,
    id: String,
    /// `queued` | `full`
    state: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusDto {
    /// The hub runs (paired devices can reach this PC at home).
    running: bool,
    enabled: bool,
    devices: Vec<DeviceDto>,
    queued: Vec<QueuedDto>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TakeDto {
    items: Vec<Entry>,
    answers: Vec<Answer>,
}

// ---- commands (all `async`: two of them wait for a native dialog) ----

#[tauri::command(async)]
pub fn exchange_status(app: AppHandle, state: State<'_, ExchangeHost>) -> StatusDto {
    let queued = state
        .files(&app)
        .map(|(_, o)| o.queued())
        .unwrap_or_default()
        .into_iter()
        .map(|(peer, id, state)| QueuedDto { peer, id, state })
        .collect();
    let Ok(parts) = state.parts() else {
        // the hub is off: the stored switch still says what the module is at this PC
        let enabled = exchange_dir(&app).is_some_and(|d| switch_at(&d).enabled());
        return StatusDto {
            running: false,
            enabled,
            devices: Vec::new(),
            queued,
        };
    };
    let devices = parts
        .trust
        .list()
        .into_iter()
        .filter(|d| !d.revoked)
        .map(|d| {
            let grant = parts.exchange.grant_of(&d.key);
            DeviceDto {
                id: hex(d.key.as_bytes()),
                name: plain(&d.name),
                last_seen: d.last_seen,
                on: grant.on,
                paused: grant.paused,
                connected: parts.exchange.connected(&d.key),
            }
        })
        .collect();
    StatusDto {
        running: true,
        enabled: parts.exchange.enabled(),
        devices,
        queued,
    }
}

/// Queues a message or link for a paired device; it goes out on that device's next session.
#[tauri::command(async)]
pub fn exchange_send(
    app: AppHandle,
    state: State<'_, ExchangeHost>,
    peer: String,
    id: String,
    kind: String,
    body: String,
) -> Result<(), String> {
    let parts = state.parts()?;
    let key = PublicKey::from_bytes(lan_sync::trust::file::from_hex32(&peer).ok_or("bad-peer")?);
    parts
        .trust
        .find_by_key(&key)
        .filter(|d| !d.revoked)
        .ok_or("not-found")?;
    let item = Item::new(
        id_from_hex(&id).ok_or("bad-id")?,
        kind_from(&kind).ok_or("bad-kind")?,
        body,
    )
    .map_err(|_| "bad-item")?;
    let (_, outbox) = state.files(&app).ok_or("no-data-dir")?;
    // always the lower-case key: the hub looks the queue up by it
    outbox.push(&hex(key.as_bytes()), &item, unix_ms())
}

/// Received items the web view has not taken over yet, and the devices' answers it has not
/// confirmed (both survive a restart until `exchange_confirm`).
#[tauri::command(async)]
pub fn exchange_take(app: AppHandle, state: State<'_, ExchangeHost>) -> TakeDto {
    match state.files(&app) {
        Some((inbox, outbox)) => TakeDto {
            items: inbox.pending(),
            answers: outbox.answers(),
        },
        None => TakeDto {
            items: Vec::new(),
            answers: Vec::new(),
        },
    }
}

/// The web view stored these items and answers.
#[tauri::command(async)]
pub fn exchange_confirm(
    app: AppHandle,
    state: State<'_, ExchangeHost>,
    items: Vec<Key>,
    answers: Vec<Key>,
) {
    if let Some((inbox, outbox)) = state.files(&app) {
        inbox.confirm(&items);
        outbox.confirm_answers(&answers);
    }
}

/// The module at this PC: off is immediate; on with a stored grant is asked first.
#[tauri::command(async)]
pub fn exchange_set_enabled(
    app: AppHandle,
    state: State<'_, ExchangeHost>,
    enabled: bool,
) -> Result<(), String> {
    let parts = state.parts()?;
    if !enabled || parts.exchange.enabled() {
        return parts
            .exchange
            .set_enabled(enabled)
            .map_err(|_| "storage".to_owned());
    }
    let lang = crate::capture::native_lang(&app);
    let granted: Vec<String> = parts
        .trust
        .list()
        .into_iter()
        .filter(|d| !d.revoked && parts.exchange.grant_of(&d.key).effective())
        .map(|d| shown_name(lang, &d.name))
        .collect();
    if !granted.is_empty() {
        ask(&app, &state, &parts, lang, &granted.join(", "))?;
    }
    parts
        .exchange
        .set_enabled(true)
        .map_err(|_| "storage".to_owned())
}

/// One device's grant. Switching it on or un-pausing is asked first; off or pause is immediate.
#[tauri::command(async)]
pub fn exchange_set_device(
    app: AppHandle,
    state: State<'_, ExchangeHost>,
    id: String,
    on: bool,
    paused: bool,
) -> Result<(), String> {
    let parts = state.parts()?;
    let key = PublicKey::from_bytes(lan_sync::trust::file::from_hex32(&id).ok_or("bad-id")?);
    let device = parts
        .trust
        .find_by_key(&key)
        .filter(|d| !d.revoked)
        .ok_or("not-found")?;
    let grant = ExchangeGrant { on, paused };
    let old = parts.exchange.grant_of(&key);
    if grant.widens(&old) {
        let lang = crate::capture::native_lang(&app);
        ask(&app, &state, &parts, lang, &shown_name(lang, &device.name))?;
        // answered for another state? (changed at the PC while the question was on screen)
        if parts.exchange.grant_of(&key) != old {
            return Err("changed".to_owned());
        }
    }
    parts
        .exchange
        .set_device(&key, grant)
        .map_err(|_| "storage".to_owned())
}

/// The native question, never while a phone controls mouse and keyboard (it could click it).
fn ask(
    app: &AppHandle,
    state: &ExchangeHost,
    parts: &Parts,
    lang: Lang,
    names: &str,
) -> Result<(), String> {
    // The ticket comes first: a mouse/keyboard session opened at any moment from here on –
    // before the question, while it is on screen (and closed again), or still open – refuses.
    let ticket = parts.remote.ticket();
    if parts.remote.full_session_open() {
        return Err("busy-controlled".to_owned());
    }
    let _asking = Asking::take(&state.asking)?;
    if !confirmed(app, lang, names) {
        return Err("cancelled".to_owned());
    }
    parts
        .remote
        .confirm(ticket)
        .map_err(|_| "busy-controlled".to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_in_a_dialog_are_plain_text() {
        assert_eq!(plain("Svens\u{202E}Handy\n"), "SvensHandy");
        assert_eq!(shown_name(Lang::De, "  "), "Dein Handy");
        assert_eq!(shown_name(Lang::En, ""), "Your phone");
        assert_eq!(plain(&"x".repeat(100)).len(), 64);
        assert_eq!(plain("Pi\u{FEFF}xel\u{2060} 7\u{00AD}"), "Pixel 7");
    }
}
