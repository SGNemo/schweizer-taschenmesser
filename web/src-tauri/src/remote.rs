//! Remote control, PC side (desktop only): the thin Tauri side around `lan_sync::input` and the
//! `remote_input` crate. Rules: `docs/rules/remote-control.md`.
//!
//! What decides lives in the crates (and is tested there). This file
//! * hands the hub a sink ([`Sink`]): media actions go to the worker of `remote_input` (plain
//!   system calls), pointer actions to its pointer thread (the one place that simulates input);
//!   keys and text are dropped here (a later package) – nothing in this file or in any Tauri
//!   command simulates input,
//! * offers the PC's own controls to the settings page. Every widening (a higher level, lifting a
//!   pause, dropping the unlock request, the master switch) is confirmed in a **native** dialog
//!   first, in a fixed order: take `Remote::ticket()`, show the dialog, call the setter with the
//!   ticket. The page cannot answer that dialog, and the crate refuses a widening while a
//!   mouse/keyboard session is open or was opened since the ticket,
//! * keeps the tray telling the truth from Rust state while a device controls the PC.
//!
//! Nothing here logs. No command takes an input action; the only way in is the hub's input session.

use crate::texts::{self, Lang};
use ::lan_sync::input::remote::SwitchError;
use ::lan_sync::input::wire::{Button, Level, Media, PcState, VOLUME_UNKNOWN};
use ::lan_sync::input::{Action, ControlError, FileSwitch, InputSink, MasterSwitch, Remote};
use ::lan_sync::noise::PublicKey;
use ::lan_sync::trust::file::{from_hex32, to_hex};
use ::lan_sync::trust::{FileTrustStore, RemoteGrant, TrustStore};
use remote_input::{Command, Pointer, PointerAction, Worker};
use serde::Serialize;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::{DialogExt as _, MessageDialogButtons, MessageDialogKind};

/// How often the tray is compared with who controls right now (only while the hub runs).
const WATCH: Duration = Duration::from_millis(250);
/// Longest device name shown in a native text (it is whatever the device claimed).
const NAME_MAX_CHARS: usize = 40;
/// Devices listed in the master-switch question; more are summed up in one line.
const ASK_LIST_MAX: usize = 6;

// ---- the sink ----

/// What the hub's input session acts through. Returns at once – the worker thread does the calls –
/// except `state()` after a quiet time (bounded, see `InputSink::state`).
pub struct Sink(Worker, Pointer);

impl Sink {
    pub fn start() -> Sink {
        Sink(Worker::start(), Pointer::start())
    }
}

/// The hub's pointer actions in the words of `remote_input`; `None` for everything else.
fn pointer_of(action: &Action) -> Option<PointerAction> {
    Some(match *action {
        Action::Move { dx, dy } => PointerAction::Move { dx, dy },
        Action::Button { button, down } => PointerAction::Button {
            button: match button {
                Button::Left => remote_input::Button::Left,
                Button::Right => remote_input::Button::Right,
            },
            down,
        },
        Action::Scroll { dx, dy } => PointerAction::Scroll { dx, dy },
        Action::Key(_) | Action::Media(_) | Action::Text(_) => return None,
    })
}

fn command_of(media: Media) -> Command {
    match media {
        Media::PlayPause => Command::PlayPause,
        Media::Next => Command::Next,
        Media::Previous => Command::Previous,
        Media::VolumeUp => Command::VolumeUp,
        Media::VolumeDown => Command::VolumeDown,
        Media::MuteToggle => Command::MuteToggle,
        Media::Lock => Command::Lock,
    }
}

fn pc_state(state: remote_input::State) -> PcState {
    PcState {
        volume: state.volume.map_or(VOLUME_UNKNOWN, |v| v.min(100)),
        mute: state.mute,
        playing: state.playing,
        locked: state.locked,
    }
}

impl InputSink for Sink {
    fn supported(&self) -> bool {
        self.0.supported()
    }

    fn state(&self) -> PcState {
        pc_state(self.0.state())
    }

    fn apply(&self, action: Action) {
        // Keys and text have no sink yet: dropped, never turned into anything.
        if let Action::Media(media) = action {
            self.0.send(command_of(media));
        } else if let Some(pointer) = pointer_of(&action) {
            self.1.send(pointer);
        }
    }
}

/// The master switch of a PC whose switch file cannot be read: off, and it stays off.
struct ClosedSwitch;

impl MasterSwitch for ClosedSwitch {
    fn enabled(&self) -> bool {
        false
    }
    fn set(&self, on: bool) -> Result<(), SwitchError> {
        if on {
            Err(SwitchError)
        } else {
            Ok(())
        }
    }
}

/// The remote-control parts of a hub: its controls and its sink. The switch file sits next to the
/// trust list; an unreadable one keeps remote control off (fail closed).
pub fn parts(dir: &Path, trust: Arc<FileTrustStore>) -> (Arc<Remote>, Arc<Sink>) {
    let remote = Arc::new(Remote::new(trust, switch_at(&dir.join("remote.json"))));
    (remote, Arc::new(Sink::start()))
}

fn switch_at(path: &Path) -> Arc<dyn MasterSwitch> {
    match FileSwitch::open(path) {
        Ok(switch) => Arc::new(switch),
        Err(_) => Arc::new(ClosedSwitch),
    }
}

// ---- state shared with the tray ----

#[derive(Default)]
pub struct RemoteHost {
    slot: Mutex<Option<Attached>>,
    /// A confirmation is on screen; a second one is refused instead of stacked.
    asking: AtomicBool,
    /// What was taken away at this PC since the app started. A hub that is stopped and started
    /// reads switch and grants from disk again; a narrowing whose write failed would come back
    /// without anyone being asked. It is applied again on every start instead.
    narrowed: Mutex<Narrowed>,
}

#[derive(Default)]
struct Narrowed {
    off: bool,
    grants: Vec<([u8; 32], RemoteGrant)>,
}

impl Narrowed {
    fn keep(&mut self, key: &PublicKey, grant: RemoteGrant) {
        self.forget(key);
        self.grants.push((*key.as_bytes(), grant));
    }

    fn forget(&mut self, key: &PublicKey) {
        self.grants.retain(|(k, _)| k != key.as_bytes());
    }

    /// Puts every remembered narrowing onto freshly loaded controls. No ticket is passed, so
    /// nothing here can widen: the crate refuses that.
    fn apply(&self, remote: &Remote) {
        if self.off {
            let _ = remote.set_enabled(false, None);
        }
        for (key, grant) in &self.grants {
            let _ = remote.set_grant(&PublicKey::from_bytes(*key), *grant, None);
        }
    }
}

enum Signal {
    /// Something changed at the PC: look now instead of at the next tick.
    Look,
    Stop,
}

struct Attached {
    parts: Parts,
    thread: Option<JoinHandle<()>>,
}

#[derive(Clone)]
struct Parts {
    remote: Arc<Remote>,
    trust: Arc<FileTrustStore>,
    supported: bool,
    /// To the thread that keeps the tray in step – the only writer of the tray's controller.
    watcher: Sender<Signal>,
}

impl Parts {
    /// Tells the tray thread to look now.
    fn look(&self) {
        let _ = self.watcher.send(Signal::Look);
    }
}

impl RemoteHost {
    fn parts(&self) -> Result<Parts, String> {
        let slot = self.slot.lock().map_err(|_| "internal")?;
        Ok(slot.as_ref().ok_or("not-started")?.parts.clone())
    }

    fn narrowed(&self, change: impl FnOnce(&mut Narrowed)) {
        if let Ok(mut narrowed) = self.narrowed.lock() {
            change(&mut narrowed);
        }
    }

    /// Ends the controlling session, pauses that device and remembers the pause.
    fn end(&self, parts: &Parts) -> bool {
        let ended = parts.remote.end();
        if let Some(key) = &ended {
            let grant = parts.remote.grant_of(key);
            self.narrowed(|n| n.keep(key, grant));
        }
        parts.look();
        ended.is_some()
    }
}

/// Characters that change how the text around them is laid out or hide in it: direction marks
/// and overrides, zero-width and other invisible format characters.
fn invisible(c: char) -> bool {
    matches!(c,
        '\u{00AD}' | '\u{061C}' | '\u{180E}' | '\u{200B}'..='\u{200F}' | '\u{202A}'..='\u{202E}'
        | '\u{2060}'..='\u{206F}' | '\u{FEFF}' | '\u{FFF9}'..='\u{FFFB}' | '\u{E0000}'..='\u{E007F}')
}

fn quote(c: char) -> bool {
    matches!(
        c,
        '"' | '“'
            | '”'
            | '„'
            | '‟'
            | '«'
            | '»'
            | '‹'
            | '›'
            | '‘'
            | '’'
            | '‚'
            | '‛'
            | '`'
            | '´'
    )
}

/// A claimed device name as one line of plain text for a native dialog or tooltip: no control or
/// invisible characters, no quotation marks (the name must not be able to close the quotes around
/// it or turn the sentence after it around), capped. May be empty.
fn plain(name: &str) -> String {
    let flat: String = name
        .chars()
        .filter(|c| !invisible(*c))
        .map(|c| match c {
            c if c.is_control() => ' ',
            c if quote(c) => '\'',
            c => c,
        })
        .collect();
    let joined = flat.split_whitespace().collect::<Vec<_>>().join(" ");
    if joined.chars().count() > NAME_MAX_CHARS {
        let mut cut: String = joined.chars().take(NAME_MAX_CHARS - 1).collect();
        cut.push('…');
        cut
    } else {
        joined
    }
}

/// What a device is called in a native text: its plain name, or – without one – a neutral label
/// with the first characters of its id, so two unnamed devices can be told apart.
fn shown_name(lang: Lang, name: &str, key: &PublicKey) -> String {
    let name = plain(name);
    if name.is_empty() {
        let id = to_hex(key.as_bytes());
        texts::remote_unnamed(lang, &id[..4])
    } else {
        name
    }
}

fn name_of(lang: Lang, trust: &FileTrustStore, key: &PublicKey) -> String {
    let name = trust.find_by_key(key).map(|d| d.name).unwrap_or_default();
    shown_name(lang, &name, key)
}

/// The hub started: its controls become reachable, and a small thread keeps the tray in step
/// with who controls. Called with the hub lock held, so it only stores and spawns.
pub fn attach(app: &AppHandle, remote: Arc<Remote>, trust: Arc<FileTrustStore>, supported: bool) {
    let host = app.state::<RemoteHost>();
    let Ok(mut slot) = host.slot.lock() else {
        return;
    };
    // what was taken away earlier in this run holds for the freshly loaded controls too
    host.narrowed(|n| n.apply(&remote));
    let (watcher, rx) = mpsc::channel::<Signal>();
    let parts = Parts {
        remote,
        trust,
        supported,
        watcher,
    };
    let thread = {
        let app = app.clone();
        let remote = parts.remote.clone();
        let trust = parts.trust.clone();
        std::thread::Builder::new()
            .name("remote-tray".into())
            .spawn(move || {
                watch(
                    rx,
                    || {
                        remote.status().controller.map(|(key, _)| {
                            name_of(crate::capture::native_lang(&app), &trust, &key)
                        })
                    },
                    |controller| crate::capture::set_remote_tray(&app, controller),
                )
            })
            .ok()
    };
    *slot = Some(Attached { parts, thread });
}

/// The tray thread: the only writer of the tray's controller. What it last wrote is what the
/// tray shows, so "changed" is always judged against the truth. It looks every [`WATCH`] and at
/// once on [`Signal::Look`]; when the hub stops (or its controls are gone) nobody controls any
/// more.
fn watch(
    rx: mpsc::Receiver<Signal>,
    controller: impl Fn() -> Option<String>,
    mut write: impl FnMut(Option<String>),
) {
    let mut shown: Option<String> = None;
    loop {
        let now = controller();
        if now != shown {
            write(now.clone());
            shown = now;
        }
        match rx.recv_timeout(WATCH) {
            Ok(Signal::Look) | Err(mpsc::RecvTimeoutError::Timeout) => {}
            Ok(Signal::Stop) | Err(mpsc::RecvTimeoutError::Disconnected) => {
                if shown.is_some() {
                    write(None);
                }
                return;
            }
        }
    }
}

/// The hub stopped: no controls, and the tray is back to normal. Called after the sessions were
/// closed.
pub fn detach(app: &AppHandle) {
    let taken = app
        .state::<RemoteHost>()
        .slot
        .lock()
        .ok()
        .and_then(|mut slot| slot.take());
    if let Some(mut attached) = taken {
        let _ = attached.parts.watcher.send(Signal::Stop);
        if let Some(thread) = attached.thread.take() {
            let _ = thread.join();
        }
    }
}

/// "Fernsteuerung beenden" in the tray: ends the session and pauses that device.
pub fn end_from_tray(app: &AppHandle) {
    let host = app.state::<RemoteHost>();
    if let Ok(parts) = host.parts() {
        host.end(&parts);
    }
}

// ---- what the web app sees ----

fn level_name(level: Level) -> &'static str {
    match level {
        Level::Off => "off",
        Level::Media => "media",
        Level::Full => "full",
    }
}

fn level_from(name: &str) -> Option<Level> {
    Some(match name {
        "off" => Level::Off,
        "media" => Level::Media,
        "full" => Level::Full,
        _ => return None,
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteStatusDto {
    /// This PC can be controlled at all (Windows).
    supported: bool,
    /// The master switch.
    enabled: bool,
    controller: Option<ControllerDto>,
    devices: Vec<RemoteDeviceDto>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ControllerDto {
    id: String,
    /// Plain text only (it is whatever the device claimed).
    name: String,
    level: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteDeviceDto {
    id: String,
    name: String,
    last_seen: Option<u64>,
    level: &'static str,
    paused: bool,
    unlock: bool,
}

fn status_of(lang: Lang, parts: &Parts) -> RemoteStatusDto {
    let status = parts.remote.status();
    RemoteStatusDto {
        supported: parts.supported,
        enabled: status.enabled,
        controller: status.controller.map(|(key, level)| ControllerDto {
            id: to_hex(key.as_bytes()),
            name: name_of(lang, &parts.trust, &key),
            level: level_name(level),
        }),
        devices: parts
            .trust
            .list()
            .into_iter()
            .filter(|d| !d.revoked)
            .map(|d| {
                let grant = parts.remote.grant_of(&d.key);
                RemoteDeviceDto {
                    id: to_hex(d.key.as_bytes()),
                    name: shown_name(lang, &d.name, &d.key),
                    last_seen: d.last_seen,
                    level: level_name(grant.level),
                    paused: grant.paused,
                    unlock: grant.unlock,
                }
            })
            .collect(),
    }
}

fn error_name(e: ControlError) -> &'static str {
    match e {
        ControlError::BusyControlled => "busy-controlled",
        ControlError::Unconfirmed => "unconfirmed",
        ControlError::NotFound => "not-found",
        ControlError::Storage => "failed",
    }
}

fn unix_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_secs())
}

/// The question for one device: which device, what it may do afterwards, and when it was last in
/// touch. The name stands alone on its own labelled line, never inside a sentence.
fn device_question(
    lang: Lang,
    name: &str,
    old: &RemoteGrant,
    new: &RemoteGrant,
    last_seen: Option<u64>,
    now: u64,
) -> String {
    let mut lines = vec![
        texts::remote_ask_device(lang, name),
        texts::remote_ask_level(lang, new.level).to_owned(),
    ];
    if old.paused && !new.paused {
        lines.push(texts::remote_ask_unpause(lang).to_owned());
    }
    if old.unlock && !new.unlock {
        lines.push(texts::remote_ask_no_unlock(lang).to_owned());
    }
    lines.push(texts::remote_last_contact(lang, last_seen, now));
    lines.join("\n\n")
}

/// The question for the master switch: every device that may control once it is on.
fn switch_question(lang: Lang, granted: &[(String, Level)]) -> String {
    let mut lines = vec![texts::remote_ask_switch(lang).to_owned()];
    for (name, level) in granted.iter().take(ASK_LIST_MAX) {
        lines.push(texts::remote_ask_switch_line(lang, name, *level));
    }
    if granted.len() > ASK_LIST_MAX {
        lines.push(texts::remote_ask_more(lang, granted.len() - ASK_LIST_MAX));
    }
    lines.join("\n")
}

/// Mouse and keyboard, or one protection less: the question carries the warning sign. Media
/// alone is asked calmly.
fn serious(old: &RemoteGrant, new: &RemoteGrant) -> bool {
    new.level == Level::Full || (old.unlock && !new.unlock)
}

/// Resets "a confirmation is on screen" however the command ends.
struct Asking<'a>(&'a AtomicBool);

impl<'a> Asking<'a> {
    fn take(flag: &'a AtomicBool) -> Result<Self, String> {
        if flag.swap(true, Ordering::SeqCst) {
            return Err("busy".to_owned());
        }
        Ok(Asking(flag))
    }
}

impl Drop for Asking<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

/// Shows the native question and waits for the answer. Runs on a command thread (never the main
/// thread); the page cannot answer it.
fn confirmed(app: &AppHandle, lang: Lang, text: String, serious: bool) -> bool {
    let (title, allow, cancel) = texts::remote_dialog(lang);
    let kind = if serious {
        MessageDialogKind::Warning
    } else {
        MessageDialogKind::Info
    };
    let mut dialog = app.dialog().message(text).title(title).kind(kind).buttons(
        MessageDialogButtons::OkCancelCustom(allow.into(), cancel.into()),
    );
    if let Some(window) = app.get_webview_window("main") {
        dialog = dialog.parent(&window);
    }
    dialog.blocking_show()
}

// ---- commands ----
//
// All `async` (off the main thread): two of them wait for a native dialog. None of them takes or
// triggers an input action – `tests/commands.rs` reads this part of the file to keep it that way.

#[tauri::command(async)]
pub fn remote_status(
    app: AppHandle,
    state: State<'_, RemoteHost>,
) -> Result<RemoteStatusDto, String> {
    Ok(status_of(
        crate::capture::native_lang(&app),
        &state.parts()?,
    ))
}

/// The master switch. Off is immediate. On is a widening: asked at the PC whenever a device
/// holds a grant.
#[tauri::command(async)]
pub fn remote_set_enabled(
    app: AppHandle,
    state: State<'_, RemoteHost>,
    enabled: bool,
) -> Result<(), String> {
    let parts = state.parts()?;
    if !enabled {
        // remembered first: off holds for this run even if it cannot be written
        state.narrowed(|n| n.off = true);
        let result = parts.remote.set_enabled(false, None);
        parts.look();
        return result.map_err(|e| error_name(e).to_owned());
    }
    if parts.remote.enabled() {
        return Ok(());
    }
    // The ticket comes first: a mouse/keyboard session opened at any moment from here on –
    // before the question, or while it is on screen – makes the setter refuse.
    let ticket = parts.remote.ticket();
    if parts.remote.full_session_open() {
        return Err("busy-controlled".to_owned());
    }
    let _asking = Asking::take(&state.asking)?;
    let lang = crate::capture::native_lang(&app);
    let granted: Vec<(String, Level)> = parts
        .trust
        .list()
        .into_iter()
        .filter(|d| !d.revoked)
        .filter_map(|d| {
            let level = parts.remote.grant_of(&d.key).effective();
            (level > Level::Off).then(|| (shown_name(lang, &d.name, &d.key), level))
        })
        .collect();
    if !granted.is_empty() {
        let serious = granted.iter().any(|(_, level)| *level == Level::Full);
        if !confirmed(&app, lang, switch_question(lang, &granted), serious) {
            return Err("cancelled".to_owned());
        }
    }
    parts
        .remote
        .set_enabled(true, Some(ticket))
        .map_err(|e| error_name(e).to_owned())?;
    state.narrowed(|n| n.off = false);
    Ok(())
}

/// The grant of one paired device: level, pause, "unlock at the phone". A change that gives or
/// gives back control is asked at the PC first; a narrowing is immediate.
#[tauri::command(async)]
pub fn remote_set_device(
    app: AppHandle,
    state: State<'_, RemoteHost>,
    id: String,
    level: String,
    paused: bool,
    unlock: bool,
) -> Result<(), String> {
    let parts = state.parts()?;
    let key = PublicKey::from_bytes(from_hex32(&id).ok_or("bad-id")?);
    let grant = RemoteGrant {
        level: level_from(&level).ok_or("bad-level")?,
        paused,
        unlock,
    };
    let device = parts
        .trust
        .find_by_key(&key)
        .filter(|d| !d.revoked)
        .ok_or("not-found")?;
    let old = parts.remote.grant_of(&key);
    if !grant.widens(&old) {
        let result = parts.remote.set_grant(&key, grant, None);
        // What holds now is remembered for this run, even if it could not be written – read
        // back after the call, so a pause that landed in between is kept, not overwritten.
        if !matches!(result, Err(ControlError::NotFound)) {
            let holds = parts.remote.grant_of(&key);
            state.narrowed(|n| n.keep(&key, holds));
        }
        parts.look();
        return result.map_err(|e| error_name(e).to_owned());
    }
    // The ticket comes first: a mouse/keyboard session opened at any moment from here on –
    // before the question, or while it is on screen – makes the setter refuse.
    let ticket = parts.remote.ticket();
    if parts.remote.full_session_open() {
        return Err("busy-controlled".to_owned());
    }
    let _asking = Asking::take(&state.asking)?;
    let lang = crate::capture::native_lang(&app);
    let text = device_question(
        lang,
        &shown_name(lang, &device.name, &key),
        &old,
        &grant,
        device.last_seen,
        unix_secs(),
    );
    if !confirmed(&app, lang, text, serious(&old, &grant)) {
        return Err("cancelled".to_owned());
    }
    // The question described the step from `old`. If the grant changed while it was on screen
    // (paused from the tray, narrowed elsewhere), the answer was given to another question.
    if parts.remote.grant_of(&key) != old {
        return Err("changed".to_owned());
    }
    parts
        .remote
        .set_grant(&key, grant, Some(ticket))
        .map_err(|e| error_name(e).to_owned())?;
    state.narrowed(|n| n.forget(&key));
    Ok(())
}

/// "Fernsteuerung beenden": ends the controlling session and pauses that device. `false` if
/// nobody controlled.
#[tauri::command(async)]
pub fn remote_end(state: State<'_, RemoteHost>) -> Result<bool, String> {
    let parts = state.parts()?;
    Ok(state.end(&parts))
}

#[cfg(test)]
mod tests {
    use super::*;
    use ::lan_sync::input::wire::{Button, Key};
    use ::lan_sync::input::MemorySwitch;
    use ::lan_sync::trust::MemoryTrustStore;
    use remote_input::System;
    use std::sync::atomic::AtomicUsize;

    #[derive(Default)]
    struct Seen {
        media: AtomicUsize,
        volume_sets: AtomicUsize,
        mute_sets: AtomicUsize,
        locks: AtomicUsize,
        pointer: Mutex<Vec<String>>,
    }

    struct FakeSystem(Arc<Seen>);

    /// Writes down what the pointer was asked to do.
    struct FakeMouse(Arc<Seen>);

    impl remote_input::Mouse for FakeMouse {
        fn moved(&mut self, dx: i32, dy: i32) {
            self.0
                .pointer
                .lock()
                .unwrap()
                .push(format!("move {dx} {dy}"));
        }
        fn button(&mut self, button: remote_input::Button, down: bool) {
            let which = match button {
                remote_input::Button::Left => "left",
                remote_input::Button::Right => "right",
            };
            self.0
                .pointer
                .lock()
                .unwrap()
                .push(format!("{which} {down}"));
        }
        fn wheel(&mut self, horizontal: bool, amount: i32) {
            self.0
                .pointer
                .lock()
                .unwrap()
                .push(format!("wheel {horizontal} {amount}"));
        }
    }

    impl System for FakeSystem {
        fn volume(&mut self) -> Option<f32> {
            Some(0.5)
        }
        fn set_volume(&mut self, _volume: f32) -> bool {
            self.0.volume_sets.fetch_add(1, Ordering::SeqCst);
            true
        }
        fn mute(&mut self) -> Option<bool> {
            Some(false)
        }
        fn set_mute(&mut self, _mute: bool) -> bool {
            self.0.mute_sets.fetch_add(1, Ordering::SeqCst);
            true
        }
        fn media(&mut self, _command: Command) -> bool {
            self.0.media.fetch_add(1, Ordering::SeqCst);
            true
        }
        fn playing(&mut self) -> Option<bool> {
            Some(true)
        }
        fn lock(&mut self) -> bool {
            self.0.locks.fetch_add(1, Ordering::SeqCst);
            true
        }
        fn locked(&mut self) -> Option<bool> {
            Some(false)
        }
    }

    fn fake_sink() -> (Sink, Arc<Seen>) {
        let seen = Arc::new(Seen::default());
        let for_worker = seen.clone();
        let for_mouse = seen.clone();
        let sink = Sink(
            Worker::with(move || Some(Box::new(FakeSystem(for_worker)) as Box<dyn System>)),
            Pointer::with(Box::new(FakeMouse(for_mouse))),
        );
        (sink, seen)
    }

    fn settle(sink: &Sink) {
        // the worker handles messages in order: a fresh state means everything before it ran
        for _ in 0..50 {
            std::thread::sleep(Duration::from_millis(10));
            let _ = sink.state();
        }
    }

    #[test]
    fn the_sink_sends_media_to_the_worker_the_pointer_to_its_thread_and_drops_the_rest() {
        let (sink, seen) = fake_sink();
        assert!(sink.supported());
        sink.apply(Action::Key(Key::Enter));
        sink.apply(Action::Text("abc".into()));
        sink.apply(Action::Move { dx: 5, dy: -5 });
        sink.apply(Action::Button {
            button: Button::Left,
            down: true,
        });
        sink.apply(Action::Scroll { dx: 0, dy: 8 });
        sink.apply(Action::Button {
            button: Button::Left,
            down: false,
        });
        sink.apply(Action::Button {
            button: Button::Right,
            down: false,
        });
        settle(&sink);
        let total = |s: &Seen| {
            s.media.load(Ordering::SeqCst)
                + s.volume_sets.load(Ordering::SeqCst)
                + s.mute_sets.load(Ordering::SeqCst)
                + s.locks.load(Ordering::SeqCst)
        };
        assert_eq!(
            total(&seen),
            0,
            "a non-media action reached the media worker"
        );
        // keys and text became nothing; the release of a button nobody pressed is ignored
        assert_eq!(
            *seen.pointer.lock().unwrap(),
            ["move 5 -5", "left true", "wheel false -120", "left false"]
        );
        sink.apply(Action::Media(Media::PlayPause));
        sink.apply(Action::Media(Media::VolumeDown));
        sink.apply(Action::Media(Media::Lock));
        settle(&sink);
        assert_eq!(seen.media.load(Ordering::SeqCst), 1);
        assert_eq!(seen.volume_sets.load(Ordering::SeqCst), 1);
        assert_eq!(seen.locks.load(Ordering::SeqCst), 1);
        assert_eq!(
            seen.pointer.lock().unwrap().len(),
            4,
            "media moved the pointer"
        );
        let state = sink.state();
        assert_eq!(
            (state.volume, state.playing, state.locked),
            (50, true, false)
        );
    }

    #[test]
    fn an_unknown_volume_and_an_unreadable_pc_stay_unknown_on_the_wire() {
        let unknown = pc_state(remote_input::State::UNKNOWN);
        assert_eq!(unknown.volume, VOLUME_UNKNOWN);
        assert!(unknown.locked);
        let loud = pc_state(remote_input::State {
            volume: Some(200),
            mute: true,
            playing: false,
            locked: false,
        });
        assert_eq!((loud.volume, loud.mute), (100, true));
    }

    #[test]
    fn every_media_action_has_its_own_command() {
        let all = [
            Media::PlayPause,
            Media::Next,
            Media::Previous,
            Media::VolumeUp,
            Media::VolumeDown,
            Media::MuteToggle,
            Media::Lock,
        ];
        let mut seen: Vec<Command> = Vec::new();
        for media in all {
            let command = command_of(media);
            assert!(!seen.contains(&command));
            seen.push(command);
        }
    }

    #[test]
    fn an_unreadable_switch_file_keeps_remote_control_off() {
        let dir = std::env::temp_dir().join(format!("nemo-remote-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("remote.json"), b"{ not json").unwrap();
        let switch = switch_at(&dir.join("remote.json"));
        let remote = Remote::new(Arc::new(MemoryTrustStore::new()), switch);
        assert!(!remote.enabled());
        let ticket = remote.ticket();
        assert_eq!(
            remote.set_enabled(true, Some(ticket)),
            Err(ControlError::Storage)
        );
        assert!(!remote.enabled());
        assert_eq!(remote.set_enabled(false, None), Ok(()));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_widening_without_the_ticket_of_a_confirmation_is_refused() {
        let remote = Remote::new(
            Arc::new(MemoryTrustStore::new()),
            Arc::new(MemorySwitch::new()),
        );
        assert_eq!(
            remote.set_enabled(true, None),
            Err(ControlError::Unconfirmed)
        );
        assert!(!remote.enabled());
    }

    #[test]
    fn level_names_round_trip_and_nothing_else_parses() {
        for level in [Level::Off, Level::Media, Level::Full] {
            assert_eq!(level_from(level_name(level)), Some(level));
        }
        for bad in ["", "Full", "admin", "media ", "2"] {
            assert_eq!(level_from(bad), None, "{bad:?}");
        }
    }

    #[test]
    fn a_claimed_name_is_one_capped_plain_line() {
        assert_eq!(plain("  Svens\nHandy\u{0007} "), "Svens Handy");
        let long = "x".repeat(200);
        assert_eq!(plain(&long).chars().count(), NAME_MAX_CHARS);
        assert!(plain(&long).ends_with('…'));
    }

    #[test]
    fn a_name_cannot_turn_the_text_around_or_close_its_quotes() {
        // right-to-left override, isolates, zero-width space, byte order mark
        assert_eq!(plain("Han\u{202E}dy\u{2066}\u{200B}\u{FEFF}"), "Handy");
        let spoof = plain("Handy“ darf nur Medien steuern. „");
        for c in ['“', '”', '„', '"', '«', '»'] {
            assert!(!spoof.contains(c), "{spoof}");
        }
        assert_eq!(plain("\u{202E}\u{200B}"), "");
    }

    #[test]
    fn a_device_without_a_name_gets_a_label_and_a_piece_of_its_id() {
        let a = PublicKey::from_bytes([0xab; 32]);
        let b = PublicKey::from_bytes([0x12; 32]);
        for lang in [Lang::De, Lang::En] {
            let named = shown_name(lang, " Pixel ", &a);
            assert_eq!(named, "Pixel");
            let unnamed = shown_name(lang, " \u{200B}\n", &a);
            assert!(unnamed.contains("abab"), "{unnamed}");
            assert_ne!(unnamed, shown_name(lang, "", &b));
        }
    }

    #[test]
    fn the_device_question_names_every_widening() {
        let old = RemoteGrant {
            level: Level::Media,
            paused: true,
            unlock: true,
        };
        let new = RemoteGrant {
            level: Level::Full,
            paused: false,
            unlock: false,
        };
        for lang in [Lang::De, Lang::En] {
            let text =
                device_question(lang, "Pixel 8", &old, &new, Some(1_000), 1_000 + 3 * 86_400);
            // the name stands alone on the first line
            assert!(text.lines().next().unwrap().ends_with("Pixel 8"), "{text}");
            assert!(text.contains(texts::remote_ask_level(lang, Level::Full)));
            assert!(text.contains(texts::remote_ask_unpause(lang)));
            assert!(text.contains(texts::remote_ask_no_unlock(lang)));
            assert!(text.contains('3'), "{text}");
            let plain_raise = device_question(lang, "A", &RemoteGrant::default(), &old, None, 0);
            assert!(!plain_raise.contains(texts::remote_ask_unpause(lang)));
            assert!(!plain_raise.contains(texts::remote_ask_no_unlock(lang)));
        }
    }

    #[test]
    fn only_mouse_and_keyboard_or_one_protection_less_carry_the_warning_sign() {
        let off = RemoteGrant::default();
        let media = RemoteGrant {
            level: Level::Media,
            ..off
        };
        let full = RemoteGrant {
            level: Level::Full,
            ..off
        };
        assert!(!serious(&off, &media));
        assert!(serious(&off, &full));
        assert!(serious(
            &media,
            &RemoteGrant {
                unlock: false,
                ..media
            }
        ));
        assert!(!serious(
            &RemoteGrant {
                paused: true,
                ..media
            },
            &media
        ));
    }

    #[test]
    fn what_was_taken_away_holds_for_freshly_loaded_controls() {
        let trust = Arc::new(MemoryTrustStore::new());
        let key = PublicKey::from_bytes([7; 32]);
        trust
            .add(::lan_sync::trust::Device {
                key,
                name: "Handy".into(),
                last_seen: None,
                revoked: false,
            })
            .unwrap();
        // as loaded from disk after a hub restart: switch on, device granted
        let switch = Arc::new(MemorySwitch::new());
        switch.set(true).unwrap();
        trust
            .set_remote(
                &key,
                RemoteGrant {
                    level: Level::Full,
                    paused: false,
                    unlock: true,
                },
            )
            .unwrap();
        let remote = Remote::new(trust.clone(), switch);
        let mut narrowed = Narrowed {
            off: true,
            ..Narrowed::default()
        };
        narrowed.keep(
            &key,
            RemoteGrant {
                level: Level::Full,
                paused: true,
                unlock: true,
            },
        );
        narrowed.apply(&remote);
        assert!(!remote.enabled());
        assert!(remote.grant_of(&key).paused);
        // a remembered grant can never give more than what is stored: no ticket, no widening
        let mut wider = Narrowed::default();
        wider.keep(
            &key,
            RemoteGrant {
                level: Level::Full,
                paused: false,
                unlock: false,
            },
        );
        wider.apply(&remote);
        assert!(remote.grant_of(&key).paused && remote.grant_of(&key).unlock);
        wider.forget(&key);
        assert!(wider.grants.is_empty());
    }

    #[test]
    fn the_tray_thread_writes_only_changes_and_clears_when_the_hub_stops() {
        let who = Arc::new(Mutex::new(None::<String>));
        let written = Arc::new(Mutex::new(Vec::<Option<String>>::new()));
        let (tx, rx) = mpsc::channel::<Signal>();
        let thread = {
            let (who, written) = (who.clone(), written.clone());
            std::thread::spawn(move || {
                watch(
                    rx,
                    || who.lock().unwrap().clone(),
                    |c| written.lock().unwrap().push(c),
                )
            })
        };
        // nobody controls: several looks, nothing written
        tx.send(Signal::Look).unwrap();
        tx.send(Signal::Look).unwrap();
        std::thread::sleep(Duration::from_millis(30));
        assert!(written.lock().unwrap().is_empty());
        // a controller appears: a look shows it at once, and only once
        *who.lock().unwrap() = Some("Pixel".into());
        tx.send(Signal::Look).unwrap();
        for _ in 0..500 {
            if !written.lock().unwrap().is_empty() {
                break;
            }
            std::thread::sleep(Duration::from_millis(2));
        }
        tx.send(Signal::Look).unwrap();
        // the hub stops while it is shown: cleared
        tx.send(Signal::Stop).unwrap();
        thread.join().unwrap();
        assert_eq!(
            *written.lock().unwrap(),
            vec![Some("Pixel".to_owned()), None]
        );
        // a dropped sender ends it too, and writes nothing when nothing was shown
        let (tx, rx) = mpsc::channel::<Signal>();
        drop(tx);
        let mut writes = 0;
        watch(rx, || None, |_| writes += 1);
        assert_eq!(writes, 0);
    }

    #[test]
    fn the_switch_question_lists_devices_and_sums_up_the_rest() {
        let many: Vec<(String, Level)> = (0..ASK_LIST_MAX + 3)
            .map(|i| (format!("Gerät {i}"), Level::Media))
            .collect();
        let text = switch_question(Lang::De, &many);
        assert!(text.contains("Gerät 0") && text.contains("Gerät 5"));
        assert!(!text.contains("Gerät 6"));
        assert!(text.contains('3'));
        assert_eq!(text.lines().count(), 1 + 2 * ASK_LIST_MAX + 1);
        // every name stands alone behind its label
        assert!(text.lines().any(|l| l == "Gerät: Gerät 0"));
    }

    #[test]
    fn a_second_confirmation_is_refused_while_one_is_open() {
        let flag = AtomicBool::new(false);
        let first = Asking::take(&flag).unwrap();
        assert_eq!(Asking::take(&flag).err().as_deref(), Some("busy"));
        drop(first);
        assert!(Asking::take(&flag).is_ok());
    }

    #[test]
    fn control_errors_have_stable_names() {
        assert_eq!(error_name(ControlError::BusyControlled), "busy-controlled");
        assert_eq!(error_name(ControlError::Unconfirmed), "unconfirmed");
        assert_eq!(error_name(ControlError::NotFound), "not-found");
        assert_eq!(error_name(ControlError::Storage), "failed");
    }
}
