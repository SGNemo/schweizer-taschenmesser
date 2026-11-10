//! Remote control, PC side (desktop only): the thin Tauri side around `lan_sync::input` and the
//! `remote_input` crate. Rules: `docs/rules/remote-control.md`.
//!
//! What decides lives in the crates (and is tested there). This file
//! * hands the hub a sink ([`Sink`]): media actions go to the worker of `remote_input`, which
//!   makes plain system calls; every other action is dropped here (pointer and keys are later
//!   packages) – nothing in this file or in any Tauri command simulates input,
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
use ::lan_sync::input::wire::{Level, Media, PcState, VOLUME_UNKNOWN};
use ::lan_sync::input::{Action, ControlError, FileSwitch, InputSink, MasterSwitch, Remote};
use ::lan_sync::noise::PublicKey;
use ::lan_sync::trust::file::{from_hex32, to_hex};
use ::lan_sync::trust::{FileTrustStore, RemoteGrant, TrustStore};
use remote_input::{Command, Worker};
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
const WATCH: Duration = Duration::from_millis(400);
/// Longest device name shown in a native text (it is whatever the device claimed).
const NAME_MAX_CHARS: usize = 40;
/// Devices listed in the master-switch question; more are summed up in one line.
const ASK_LIST_MAX: usize = 6;

// ---- the sink ----

/// What the hub's input session acts through. Returns at once: the worker thread does the calls.
pub struct Sink(Worker);

impl Sink {
    pub fn start() -> Sink {
        Sink(Worker::start())
    }
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
        // Pointer, buttons, keys and text have no sink yet: dropped, never turned into anything.
        if let Action::Media(media) = action {
            self.0.send(command_of(media));
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
    let switch: Arc<dyn MasterSwitch> = match FileSwitch::open(&dir.join("remote.json")) {
        Ok(switch) => Arc::new(switch),
        Err(_) => Arc::new(ClosedSwitch),
    };
    let remote = Arc::new(Remote::new(trust, switch));
    (remote, Arc::new(Sink::start()))
}

// ---- state shared with the tray ----

#[derive(Default)]
pub struct RemoteHost {
    slot: Mutex<Option<Attached>>,
    /// A confirmation is on screen; a second one is refused instead of stacked.
    asking: AtomicBool,
}

struct Attached {
    parts: Parts,
    stop: Sender<()>,
    thread: Option<JoinHandle<()>>,
}

#[derive(Clone)]
struct Parts {
    remote: Arc<Remote>,
    trust: Arc<FileTrustStore>,
    supported: bool,
}

impl RemoteHost {
    fn parts(&self) -> Result<Parts, String> {
        let slot = self.slot.lock().map_err(|_| "internal")?;
        Ok(slot.as_ref().ok_or("not-started")?.parts.clone())
    }
}

/// One line of plain text for a native dialog or tooltip: no control characters, capped.
fn plain(name: &str) -> String {
    let flat: String = name
        .chars()
        .map(|c| if c.is_control() { ' ' } else { c })
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

fn name_of(trust: &FileTrustStore, key: &PublicKey) -> String {
    trust
        .find_by_key(key)
        .map(|d| plain(&d.name))
        .unwrap_or_default()
}

/// The hub started: its controls become reachable, and a small thread keeps the tray in step
/// with who controls. Called with the hub lock held, so it only stores and spawns.
pub fn attach(app: &AppHandle, remote: Arc<Remote>, trust: Arc<FileTrustStore>, supported: bool) {
    let host = app.state::<RemoteHost>();
    let Ok(mut slot) = host.slot.lock() else {
        return;
    };
    let parts = Parts {
        remote,
        trust,
        supported,
    };
    let (stop, rx) = mpsc::channel::<()>();
    let thread = {
        let app = app.clone();
        let parts = parts.clone();
        std::thread::Builder::new()
            .name("remote-tray".into())
            .spawn(move || {
                let mut shown: Option<String> = None;
                loop {
                    let now = parts
                        .remote
                        .status()
                        .controller
                        .map(|(key, _)| name_of(&parts.trust, &key));
                    if now != shown {
                        crate::capture::set_remote_tray(&app, now.clone());
                        shown = now;
                    }
                    // a message or a dropped sender both mean "the hub stops"
                    if !matches!(rx.recv_timeout(WATCH), Err(mpsc::RecvTimeoutError::Timeout)) {
                        return;
                    }
                }
            })
            .ok()
    };
    *slot = Some(Attached {
        parts,
        stop,
        thread,
    });
}

/// The hub stopped: no controls, and the tray is back to normal.
pub fn detach(app: &AppHandle) {
    let taken = app
        .state::<RemoteHost>()
        .slot
        .lock()
        .ok()
        .and_then(|mut slot| slot.take());
    if let Some(mut attached) = taken {
        let _ = attached.stop.send(());
        if let Some(thread) = attached.thread.take() {
            let _ = thread.join();
        }
    }
    crate::capture::set_remote_tray(app, None);
}

/// "Fernsteuerung beenden" in the tray: ends the session and pauses that device.
pub fn end_from_tray(app: &AppHandle) {
    if let Ok(parts) = app.state::<RemoteHost>().parts() {
        let _ = parts.remote.end();
    }
    crate::capture::set_remote_tray(app, None);
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

fn status_of(parts: &Parts) -> RemoteStatusDto {
    let status = parts.remote.status();
    RemoteStatusDto {
        supported: parts.supported,
        enabled: status.enabled,
        controller: status.controller.map(|(key, level)| ControllerDto {
            id: to_hex(key.as_bytes()),
            name: name_of(&parts.trust, &key),
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
                    name: d.name,
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

/// The question for one device: what it may do afterwards, and when it was last in touch.
fn device_question(
    lang: Lang,
    name: &str,
    old: &RemoteGrant,
    new: &RemoteGrant,
    last_seen: Option<u64>,
    now: u64,
) -> String {
    let mut lines = vec![texts::remote_ask_device(lang, &plain(name), new.level)];
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
        lines.push(texts::remote_ask_switch_line(lang, &plain(name), *level));
    }
    if granted.len() > ASK_LIST_MAX {
        lines.push(texts::remote_ask_more(lang, granted.len() - ASK_LIST_MAX));
    }
    lines.join("\n")
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
fn confirmed(app: &AppHandle, lang: Lang, text: String) -> bool {
    let (title, allow, cancel) = texts::remote_dialog(lang);
    let mut dialog = app
        .dialog()
        .message(text)
        .title(title)
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancelCustom(
            allow.into(),
            cancel.into(),
        ));
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
pub fn remote_status(state: State<'_, RemoteHost>) -> Result<RemoteStatusDto, String> {
    Ok(status_of(&state.parts()?))
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
        return parts
            .remote
            .set_enabled(false, None)
            .map_err(|e| error_name(e).to_owned());
    }
    if parts.remote.enabled() {
        return Ok(());
    }
    if parts.remote.full_session_open() {
        return Err("busy-controlled".to_owned());
    }
    let _asking = Asking::take(&state.asking)?;
    // the ticket is taken before the question is shown; the setter checks it afterwards
    let ticket = parts.remote.ticket();
    let granted: Vec<(String, Level)> = parts
        .trust
        .list()
        .into_iter()
        .filter(|d| !d.revoked)
        .filter_map(|d| {
            let level = parts.remote.grant_of(&d.key).effective();
            (level > Level::Off).then_some((d.name, level))
        })
        .collect();
    if !granted.is_empty() {
        let lang = crate::webview2::system_lang();
        if !confirmed(&app, lang, switch_question(lang, &granted)) {
            return Err("cancelled".to_owned());
        }
    }
    parts
        .remote
        .set_enabled(true, Some(ticket))
        .map_err(|e| error_name(e).to_owned())
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
        return parts
            .remote
            .set_grant(&key, grant, None)
            .map_err(|e| error_name(e).to_owned());
    }
    if parts.remote.full_session_open() {
        return Err("busy-controlled".to_owned());
    }
    let _asking = Asking::take(&state.asking)?;
    // the ticket is taken before the question is shown; the setter checks it afterwards
    let ticket = parts.remote.ticket();
    let lang = crate::webview2::system_lang();
    let text = device_question(
        lang,
        &device.name,
        &old,
        &grant,
        device.last_seen,
        unix_secs(),
    );
    if !confirmed(&app, lang, text) {
        return Err("cancelled".to_owned());
    }
    parts
        .remote
        .set_grant(&key, grant, Some(ticket))
        .map_err(|e| error_name(e).to_owned())
}

/// "Fernsteuerung beenden": ends the controlling session and pauses that device. `false` if
/// nobody controlled.
#[tauri::command(async)]
pub fn remote_end(app: AppHandle, state: State<'_, RemoteHost>) -> Result<bool, String> {
    let ended = state.parts()?.remote.end().is_some();
    crate::capture::set_remote_tray(&app, None);
    Ok(ended)
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
    }

    struct FakeSystem(Arc<Seen>);

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
        let sink = Sink(Worker::with(move || {
            Some(Box::new(FakeSystem(for_worker)) as Box<dyn System>)
        }));
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
    fn the_sink_acts_on_media_and_drops_everything_else() {
        let (sink, seen) = fake_sink();
        assert!(sink.supported());
        sink.apply(Action::Move { dx: 5, dy: 5 });
        sink.apply(Action::Button {
            button: Button::Left,
            down: true,
        });
        sink.apply(Action::Scroll { dx: 0, dy: 3 });
        sink.apply(Action::Key(Key::Enter));
        sink.apply(Action::Text("abc".into()));
        settle(&sink);
        let total = |s: &Seen| {
            s.media.load(Ordering::SeqCst)
                + s.volume_sets.load(Ordering::SeqCst)
                + s.mute_sets.load(Ordering::SeqCst)
                + s.locks.load(Ordering::SeqCst)
        };
        assert_eq!(total(&seen), 0, "a non-media action reached the system");
        sink.apply(Action::Media(Media::PlayPause));
        sink.apply(Action::Media(Media::VolumeDown));
        sink.apply(Action::Media(Media::Lock));
        settle(&sink);
        assert_eq!(seen.media.load(Ordering::SeqCst), 1);
        assert_eq!(seen.volume_sets.load(Ordering::SeqCst), 1);
        assert_eq!(seen.locks.load(Ordering::SeqCst), 1);
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
        let switch: Arc<dyn MasterSwitch> = match FileSwitch::open(&dir.join("remote.json")) {
            Ok(s) => Arc::new(s),
            Err(_) => Arc::new(ClosedSwitch),
        };
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
            let text = device_question(
                lang,
                "Pixel\n8",
                &old,
                &new,
                Some(1_000),
                1_000 + 3 * 86_400,
            );
            assert!(text.contains("Pixel 8"), "{text}");
            assert!(text.contains(texts::remote_ask_unpause(lang)));
            assert!(text.contains(texts::remote_ask_no_unlock(lang)));
            assert!(text.contains('3'), "{text}");
            let plain_raise = device_question(lang, "A", &RemoteGrant::default(), &old, None, 0);
            assert!(!plain_raise.contains(texts::remote_ask_unpause(lang)));
            assert!(!plain_raise.contains(texts::remote_ask_no_unlock(lang)));
        }
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
        assert!(text.lines().count() == ASK_LIST_MAX + 2);
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
