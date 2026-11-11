//! Remote control, phone side: one input session with the paired PC. Thin glue around
//! `lan_sync::input_client` (tested there); rules in `docs/rules/remote-control.md`.
//!
//! * A connection of its own, never the sync client's `Link`: input does not wait for a sync round
//!   and the two share no frame. The device key and the pinned hub are the ones of
//!   `lan_client.rs`; both stay in Rust, the page gets neither.
//! * The phone decides nothing: what this device may do is checked by the PC for every session
//!   and every frame. This file only passes on what the page asks for – media actions and mouse
//!   buttons from fixed lists, pointer moves and wheel steps as numbers – and what the PC answers.
//!   There is no key and no text here (a later package).
//! * Two levels. `media` is asked for as before. `full` (mouse) needs a media session of this run
//!   first, because only the PC's `opened` tells whether it asks for an unlock at the phone.
//!   Whether this device is granted the level and whether the PC is locked is the PC's to say:
//!   it refuses without touching the session that is open, and that session stays here too.
//!   If the PC asks for it, the phone is unlocked first – natively, from here, not by the page:
//!   fingerprint, face or the phone's PIN, through a prompt of the secure-store plugin that uses
//!   no key and stores nothing, with texts fixed in this file – and that holds for eight hours
//!   of wall-clock time while the app runs (process memory only). What the PC says in the
//!   `opened` of the mouse session itself is checked again: a session that needs an unlock
//!   nobody gave is closed at once. The unlock is a brake on a phone lying around unlocked, not
//!   a proof to the PC.
//! * While the PC is locked no pointer and no button press is sent (the PC would drop them and
//!   count them against the session); a release always goes, so nothing stays held.
//! * One session at a time. Opening a new one closes the old one; events of a replaced session
//!   are dropped here, so the page never sees a late "closed" of a session it already left.
//! * Never unpairs: an `unknown-device` from the PC is only reported (see the header of
//!   `input_client.rs`). Whether the device is still paired is what a sync round says.
//! * Phone only: the commands are registered in the mobile handler and granted in
//!   `capabilities/mobile.json` alone. Nothing here logs; errors are short codes.

// Only the phone registers these commands; the desktop build compiles this file for its unit
// tests alone.
#![cfg_attr(not(mobile), allow(dead_code))]

use ::lan_sync::input::wire::{Button, Code, Level, Media, PcState, Record, VOLUME_UNKNOWN};
use ::lan_sync::input_client::{Event, InputError, InputSession};
use serde::Serialize;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime};
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, Runtime};

/// Most actions the page may hand over in one call (a held volume key sends one at a time).
const MAX_ACTIONS: usize = 8;
/// Most records one pointer call becomes (one frame of the wire); a longer way is cut.
const MAX_STEPS: usize = 32;
/// The farthest one record moves (the wire's `i8`, kept symmetric).
const STEP: i32 = 127;
/// How long one unlock of the phone holds for the mouse level (process memory only).
const UNLOCK_VALID: Duration = Duration::from_secs(8 * 60 * 60);
/// How long the phone's prompt may stay unanswered before the attempt counts as failed.
const PROMPT_WAIT: Duration = Duration::from_secs(120);

/// What the PC said about this device in its last `opened`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Known {
    grant: Level,
    unlock_required: bool,
}

/// The open session: its number, the connection, and the level the PC opened it at.
type Open = (u64, Arc<InputSession>, Level);

#[derive(Default)]
pub struct RemoteClient {
    /// The open session. The number tells a late event or a late `send` of an older session
    /// apart from the current one.
    session: Mutex<Option<Open>>,
    /// The number of the session in the slot (0 = none): its events are passed on.
    live: Arc<AtomicU64>,
    /// The number of the newest `open` asked for (also while it still connects).
    newest: Arc<AtomicU64>,
    /// `None` until a session was opened in this run.
    known: Mutex<Option<Known>>,
    /// The PC said it is locked (its latest state): no pointer, no button press.
    locked: Arc<AtomicBool>,
    /// When the phone was last unlocked for the mouse level. Wall-clock time: it also runs while
    /// the phone sleeps, and a clock set back counts as expired.
    unlocked: Mutex<Option<SystemTime>>,
    /// The unlock prompt is on screen: a second `open` does not raise another one.
    asking: AtomicBool,
}

impl RemoteClient {
    /// Another PC, or none: the session, what the old PC said and the unlock given for it are gone.
    pub fn reset(&self) {
        // a connect that is still under way is not wanted any more either
        self.newest.fetch_add(1, Ordering::SeqCst);
        if let Ok(mut slot) = self.session.lock() {
            self.live.store(0, Ordering::SeqCst);
            if let Some((_, session, _)) = slot.take() {
                end(session);
            }
        }
        if let Ok(mut known) = self.known.lock() {
            *known = None;
        }
        if let Ok(mut unlocked) = self.unlocked.lock() {
            *unlocked = None;
        }
        self.locked.store(false, Ordering::SeqCst);
    }
}

/// The texts of the phone's unlock prompt. Fixed here, not handed in by the page: what the
/// system's prompt says is not the page's to word. German, and English for every other language.
fn prompt_texts(lang: Option<&str>) -> (&'static str, &'static str) {
    let german = lang.is_some_and(|l| {
        let l = l.to_ascii_lowercase();
        l == "de" || l.starts_with("de-")
    });
    if german {
        ("Handy entsperren", "Für Maus und Tastatur an deinem PC")
    } else {
        ("Unlock phone", "For mouse and keyboard on your PC")
    }
}

/// What an `open` at the mouse level does first.
#[derive(Debug, PartialEq, Eq)]
enum Gate {
    Go,
    /// Ask at the phone, then go.
    Unlock,
    Refuse(&'static str),
}

/// Decides whether the phone has to be asked, from what the PC said last and from how long ago
/// the phone was unlocked. Whether this device is granted the level, and whether the PC is
/// locked, is the PC's to say: it refuses without touching the session that is open.
fn gate(known: Option<Known>, since_unlock: Option<Duration>) -> Gate {
    match known {
        // the page opens Medien first; without that nothing is known about this device
        None => Gate::Refuse("media-first"),
        Some(k) if k.unlock_required && since_unlock.map_or(true, |d| d >= UNLOCK_VALID) => {
            Gate::Unlock
        }
        Some(_) => Gate::Go,
    }
}

/// How the phone's unlock went.
#[derive(Debug, PartialEq, Eq)]
enum Unlocked {
    Yes,
    /// The phone has no screen lock at all: the session opens all the same and the page says so
    /// (a hint, not a block).
    NoLock,
}

/// The answer of the plugin's prompt as an outcome. Anything unexpected is a failure, never a
/// pass.
fn unlocked_from(status: &str) -> Result<Unlocked, &'static str> {
    match status {
        "ok" => Ok(Unlocked::Yes),
        "none" => Ok(Unlocked::NoLock),
        "cancelled" => Err("unlock-cancelled"),
        _ => Err("unlock-failed"),
    }
}

/// Whether a session the PC just opened may be kept. What the PC says in this very `opened`
/// counts, not what it said before: a mouse session that needs an unlock nobody gave in the
/// window – and on a phone that has a lock – is not kept.
fn keep(
    opened: Level,
    unlock_required: bool,
    since_unlock: Option<Duration>,
    no_lock: bool,
) -> bool {
    opened != Level::Full
        || !unlock_required
        || no_lock
        || since_unlock.is_some_and(|d| d < UNLOCK_VALID)
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StateDto {
    /// 0–100, or `null` when the PC cannot tell.
    volume: Option<u8>,
    mute: bool,
    playing: bool,
    locked: bool,
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum EventDto {
    /// The PC's state (after something this device sent, or unasked).
    State { session: u64, state: StateDto },
    /// The session is over: with the PC's reason, or without one (connection lost, idle, replaced
    /// at the PC). After this nothing follows for that session.
    Closed {
        session: u64,
        reason: Option<&'static str>,
    },
}

#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpenedDto {
    session: u64,
    /// What this session may do.
    level: &'static str,
    /// What the PC grants this device at most.
    grant: &'static str,
    unlock_required: bool,
    /// The PC asks for an unlock at the phone, and this phone has no lock the app can ask for.
    no_lock: bool,
    state: StateDto,
}

fn state_dto(state: PcState) -> StateDto {
    StateDto {
        volume: (state.volume != VOLUME_UNKNOWN).then_some(state.volume.min(100)),
        mute: state.mute,
        playing: state.playing,
        locked: state.locked,
    }
}

fn level_name(level: Level) -> &'static str {
    match level {
        Level::Off => "off",
        Level::Media => "media",
        Level::Full => "full",
    }
}

/// The level a session may be asked for.
fn level_from(name: &str) -> Option<Level> {
    match name {
        "media" => Some(Level::Media),
        "full" => Some(Level::Full),
        _ => None,
    }
}

/// Ends a session that is no longer in the slot. A `send` that is writing right now still holds
/// it; then dropping the last handle shuts the connection without waiting.
fn end(session: Arc<InputSession>) {
    if let Ok(session) = Arc::try_unwrap(session) {
        session.close();
    }
}

fn reason_name(code: Code) -> &'static str {
    match code {
        Code::RemoteOff => "remote-off",
        Code::NotGranted => "not-granted",
        Code::Busy => "busy",
        Code::Paused => "paused",
        Code::Locked => "locked",
        Code::Unsupported => "unsupported",
        Code::Ended => "ended",
        Code::Limit => "limit",
    }
}

fn error_name(e: InputError) -> &'static str {
    match e {
        InputError::Network => "network",
        InputError::NoAnswer => "no-answer",
        InputError::UnknownDevice => "unknown-device",
        InputError::Refused(code) => reason_name(code),
        InputError::Protocol => "protocol",
        InputError::Closed => "closed",
    }
}

/// The fixed list of media actions. There is no "any key".
fn media_from(name: &str) -> Option<Media> {
    Some(match name {
        "play-pause" => Media::PlayPause,
        "next" => Media::Next,
        "previous" => Media::Previous,
        "volume-up" => Media::VolumeUp,
        "volume-down" => Media::VolumeDown,
        "mute" => Media::MuteToggle,
        "lock" => Media::Lock,
        _ => return None,
    })
}

/// The fixed list of mouse buttons, pressed or released.
fn button_from(name: &str) -> Option<(Button, bool)> {
    Some(match name {
        "left-down" => (Button::Left, true),
        "left-up" => (Button::Left, false),
        "right-down" => (Button::Right, true),
        "right-up" => (Button::Right, false),
        _ => return None,
    })
}

/// What kind of action a record is, for the two checks before it goes out.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Kind {
    Media,
    /// A mouse button going down.
    Press,
    /// A mouse button coming up: always sent, so nothing stays held on the PC.
    Release,
}

/// One action of the page as a record.
fn record_from(name: &str) -> Option<(Record, Kind)> {
    if let Some(media) = media_from(name) {
        return Some((Record::Media(media), Kind::Media));
    }
    let (button, down) = button_from(name)?;
    let kind = if down { Kind::Press } else { Kind::Release };
    Some((Record::Button { button, down }, kind))
}

fn records_from(actions: &[String]) -> Result<Vec<(Record, Kind)>, &'static str> {
    if actions.is_empty() || actions.len() > MAX_ACTIONS {
        return Err("bad-action");
    }
    actions
        .iter()
        .map(|a| record_from(a).ok_or("bad-action"))
        .collect()
}

/// What of a bundle goes out on a session of `level`, with the PC locked or not. A mouse action
/// on a media session is refused whole (the PC would close the session for it). With the PC
/// locked a press is left out; media actions and releases still go.
fn sendable(
    records: Vec<(Record, Kind)>,
    level: Level,
    pc_locked: bool,
) -> Result<Vec<Record>, &'static str> {
    if level != Level::Full && records.iter().any(|(_, kind)| *kind != Kind::Media) {
        return Err("bad-level");
    }
    Ok(records
        .into_iter()
        .filter(|(_, kind)| !(pc_locked && *kind == Kind::Press))
        .map(|(record, _)| record)
        .collect())
}

/// Which pointer call this is.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Glide {
    Move,
    Scroll,
}

fn glide_from(name: &str) -> Option<Glide> {
    match name {
        "move" => Some(Glide::Move),
        "scroll" => Some(Glide::Scroll),
        _ => None,
    }
}

/// A way of `dx`, `dy` as records of at most [`STEP`] each, at most [`MAX_STEPS`] of them (one
/// frame). A longer way is shortened along its direction, never queued. Nothing for no way.
fn steps(kind: Glide, dx: i32, dy: i32) -> Vec<Record> {
    let far = i64::from(STEP) * MAX_STEPS as i64;
    let (mut x, mut y) = (i64::from(dx), i64::from(dy));
    let longest = x.abs().max(y.abs());
    if longest > far {
        x = x * far / longest;
        y = y * far / longest;
    }
    let step = i64::from(STEP);
    let mut out = Vec::new();
    while x != 0 || y != 0 {
        let (sx, sy) = (x.clamp(-step, step), y.clamp(-step, step));
        x -= sx;
        y -= sy;
        let (dx, dy) = (sx as i8, sy as i8);
        out.push(match kind {
            Glide::Move => Record::Move { dx, dy },
            Glide::Scroll => Record::Scroll { dx, dy },
        });
    }
    out
}

/// Whether an event of session `id` is passed on: it is the session in the slot, or the one that
/// is just being opened. An older session's late words are dropped.
fn passes(id: u64, live: u64, newest: u64) -> bool {
    id == live || id == newest
}

/// What an event of session `id` becomes for the page.
fn event_dto(id: u64, event: Event) -> EventDto {
    match event {
        Event::State(state) => EventDto::State {
            session: id,
            state: state_dto(state),
        },
        Event::Closed(code) => EventDto::Closed {
            session: id,
            reason: code.map(reason_name),
        },
    }
}

/// A missing pairing is its own answer; a keystore that does not answer right now is a calm
/// `network` (it must never look like "not paired any more").
fn stored_error(e: String) -> String {
    if e == "not-paired" {
        e
    } else {
        "network".to_owned()
    }
}

/// Asks at the phone, natively: fingerprint, face or the phone's PIN, through the secure-store
/// plugin's presence prompt. It uses no key and stores nothing (the vault's biometric key is not
/// touched), and no command of the page maps to it. A phone without any screen lock is not
/// blocked; an error or no answer in time is a failure, never a pass.
///
/// Compiled on every target (the plugin has the same face everywhere), so the desktop's checks
/// see this code too; only the phone ever calls it.
async fn native_unlock<R: Runtime>(
    app: &AppHandle<R>,
    lang: Option<&str>,
) -> Result<Unlocked, &'static str> {
    use tauri_plugin_secure_store::{ConfirmRequest, SecureStoreExt};
    let (title, subtitle) = prompt_texts(lang);
    let asked = app.secure_store().confirm_user(ConfirmRequest {
        title: title.to_owned(),
        subtitle: subtitle.to_owned(),
    });
    let answer = tokio::time::timeout(PROMPT_WAIT, asked)
        .await
        .map_err(|_| "unlock-failed")?
        .map_err(|_| "unlock-failed")?;
    unlocked_from(&answer.status)
}

/// Clears `asking` when the attempt ends, however it ends (also when it is dropped).
struct Asking<'a>(&'a AtomicBool);

impl Drop for Asking<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

/// How long ago the phone was unlocked; `None` = never, or the clock was set back.
fn since_unlock(state: &RemoteClient) -> Result<Option<Duration>, String> {
    Ok(state
        .unlocked
        .lock()
        .map_err(|_| "internal")?
        .and_then(|at| at.elapsed().ok()))
}

/// Before a session of the mouse level: does the phone have to be unlocked first? Touches no
/// session. `Ok(true)` = the PC asks for an unlock and this phone has no screen lock to ask for.
async fn pass_gate<R: Runtime>(app: &AppHandle<R>, lang: Option<&str>) -> Result<bool, String> {
    let state = app.state::<RemoteClient>();
    let known = *state.known.lock().map_err(|_| "internal")?;
    match gate(known, since_unlock(&state)?) {
        Gate::Go => Ok(false),
        Gate::Refuse(code) => Err(code.to_owned()),
        Gate::Unlock => {
            // one prompt at a time
            if state.asking.swap(true, Ordering::SeqCst) {
                return Err("unlock-busy".to_owned());
            }
            let _asking = Asking(&state.asking);
            match native_unlock(app, lang).await? {
                Unlocked::Yes => {
                    *state.unlocked.lock().map_err(|_| "internal")? = Some(SystemTime::now());
                    Ok(false)
                }
                Unlocked::NoLock => Ok(true),
            }
        }
    }
}

/// Opens an input session with the paired PC at `level` (`media` or `full`). The answer says
/// what the session may really do and the PC's state; later states and the end of the session
/// arrive on `on_event`. `lang` picks the language of the phone's unlock prompt.
///
/// A `media` open closes the older session of this device first. A `full` open leaves it alone
/// until the new session stands (the PC replaces it on its side): a refusal – no grant, a locked
/// PC, a dismissed unlock – costs Medien nothing, and its events keep coming.
#[tauri::command]
pub async fn remote_client_open<R: Runtime>(
    app: AppHandle<R>,
    level: String,
    lang: Option<String>,
    on_event: Channel<EventDto>,
) -> Result<OpenedDto, String> {
    let level = level_from(&level).ok_or("bad-level")?;
    let no_lock = if level == Level::Full {
        pass_gate(&app, lang.as_deref()).await?
    } else {
        false
    };
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<RemoteClient>();
        let id = state.newest.fetch_add(1, Ordering::SeqCst) + 1;
        if level != Level::Full {
            // the session this one replaces ends now
            let mut slot = state.session.lock().map_err(|_| "internal")?;
            state.live.store(0, Ordering::SeqCst);
            if let Some((_, session, _)) = slot.take() {
                drop(slot);
                end(session);
            }
        }
        let (hub, addr, name) = crate::lan_client::hub_entry(&app).map_err(stored_error)?;
        let key = crate::lan_client::stored_key(&app).map_err(stored_error)?;
        let newest = state.newest.clone();
        let live = state.live.clone();
        let locked = state.locked.clone();
        // a state the PC sent right after `opened` must not be overwritten by the older one in it
        let told = Arc::new(AtomicBool::new(false));
        let heard = told.clone();
        let (session, opened) = InputSession::open(
            addr,
            &key,
            &hub,
            &name,
            level,
            Box::new(move |event| {
                // the session in the slot, or the one that is just being opened
                if !passes(
                    id,
                    live.load(Ordering::SeqCst),
                    newest.load(Ordering::SeqCst),
                ) {
                    return;
                }
                if let Event::State(pc) = &event {
                    heard.store(true, Ordering::SeqCst);
                    locked.store(pc.locked, Ordering::SeqCst);
                }
                let _ = on_event.send(event_dto(id, event));
            }),
        )
        .map_err(|e| {
            // the PC took the level away (or switched remote control off): what it said before
            // no longer holds, so the next attempt starts with Medien again
            if let InputError::Refused(Code::NotGranted | Code::Paused | Code::RemoteOff) = e {
                if let Ok(mut known) = state.known.lock() {
                    *known = None;
                }
            }
            error_name(e).to_owned()
        })?;
        let mut slot = state.session.lock().map_err(|_| "internal")?;
        // a newer `open` overtook this one while it connected: this session is not wanted any more
        if state.newest.load(Ordering::SeqCst) != id {
            drop(slot);
            session.close();
            return Err("closed".to_owned());
        }
        *state.known.lock().map_err(|_| "internal")? = Some(Known {
            grant: opened.grant,
            unlock_required: opened.unlock_required,
        });
        if !told.load(Ordering::SeqCst) {
            state.locked.store(opened.state.locked, Ordering::SeqCst);
        }
        // what the PC says now decides, not what it said before: the next `open` asks
        if !keep(
            opened.level,
            opened.unlock_required,
            since_unlock(&state)?,
            no_lock,
        ) {
            state.live.store(0, Ordering::SeqCst);
            let old = slot.take();
            drop(slot);
            session.close();
            if let Some((_, old, _)) = old {
                end(old);
            }
            return Err("unlock-needed".to_owned());
        }
        // the session this one replaced (the PC closed it on its side already)
        state.live.store(id, Ordering::SeqCst);
        if let Some((_, old, _)) = slot.replace((id, Arc::new(session), opened.level)) {
            drop(slot);
            end(old);
        }
        Ok(OpenedDto {
            session: id,
            level: level_name(opened.level),
            grant: level_name(opened.grant),
            unlock_required: opened.unlock_required,
            no_lock,
            state: state_dto(opened.state),
        })
    })
    .await
    .map_err(|_| "internal".to_owned())?
}

/// The open session `session`, or `closed`. The lock is held only to pick it: a write that
/// stalls (the PC vanished) must not keep `open` and `close` waiting.
fn picked(state: &RemoteClient, session: u64) -> Result<(Arc<InputSession>, Level), String> {
    let slot = state.session.lock().map_err(|_| "internal")?;
    match slot.as_ref() {
        Some((id, open, level)) if *id == session => Ok((open.clone(), *level)),
        _ => Err("closed".to_owned()),
    }
}

/// Sends a small bundle of actions on session `session`: media actions, and on a session of the
/// mouse level also mouse buttons. `closed`: that session is over (open again); never a state to
/// show by itself.
#[tauri::command]
pub async fn remote_client_send<R: Runtime>(
    app: AppHandle<R>,
    session: u64,
    actions: Vec<String>,
) -> Result<(), String> {
    let records = records_from(&actions)?;
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<RemoteClient>();
        let (open, level) = picked(&state, session)?;
        let records = sendable(records, level, state.locked.load(Ordering::SeqCst))?;
        if records.is_empty() {
            return Ok(());
        }
        open.send_events(&records)
            .map_err(|e| error_name(e).to_owned())
    })
    .await
    .map_err(|_| "internal".to_owned())?
}

/// One pointer move or wheel step (`kind`: `move` or `scroll`) of `dx`, `dy` on session
/// `session`, which must be of the mouse level. Nothing is sent while the PC is locked.
#[tauri::command]
pub async fn remote_client_pointer<R: Runtime>(
    app: AppHandle<R>,
    session: u64,
    kind: String,
    dx: i32,
    dy: i32,
) -> Result<(), String> {
    let kind = glide_from(&kind).ok_or("bad-action")?;
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<RemoteClient>();
        let (open, level) = picked(&state, session)?;
        if level != Level::Full {
            return Err("bad-level".to_owned());
        }
        let records = steps(kind, dx, dy);
        if records.is_empty() || state.locked.load(Ordering::SeqCst) {
            return Ok(());
        }
        open.send_events(&records)
            .map_err(|e| error_name(e).to_owned())
    })
    .await
    .map_err(|_| "internal".to_owned())?
}

/// Ends session `session` (the page went to the background). A number that is not the open
/// session changes nothing.
#[tauri::command]
pub async fn remote_client_close<R: Runtime>(
    app: AppHandle<R>,
    session: u64,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<RemoteClient>();
        let mut slot = state.session.lock().map_err(|_| "internal")?;
        if slot.as_ref().is_some_and(|(id, _, _)| *id == session) {
            state.live.store(0, Ordering::SeqCst);
            if let Some((_, open, _)) = slot.take() {
                drop(slot);
                end(open);
            }
        }
        Ok(())
    })
    .await
    .map_err(|_| "internal".to_owned())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_fixed_media_actions_are_accepted() {
        let names = [
            "play-pause",
            "next",
            "previous",
            "volume-up",
            "volume-down",
            "mute",
            "lock",
        ];
        let all: Vec<String> = names.iter().map(|n| (*n).to_owned()).collect();
        assert_eq!(records_from(&all).unwrap().len(), names.len());
        for bad in [
            "",
            "key:a",
            "move",
            "text",
            "Lock",
            "volume-up ",
            "vk_media_next",
        ] {
            assert_eq!(
                records_from(&[bad.to_owned()]),
                Err("bad-action"),
                "{bad:?}"
            );
        }
        // one bad action refuses the whole bundle
        assert_eq!(
            records_from(&["next".to_owned(), "x".to_owned()]),
            Err("bad-action")
        );
    }

    #[test]
    fn a_bundle_is_small_and_never_empty() {
        assert_eq!(records_from(&[]), Err("bad-action"));
        let many = vec!["volume-up".to_owned(); MAX_ACTIONS + 1];
        assert_eq!(records_from(&many), Err("bad-action"));
        assert!(records_from(&many[..MAX_ACTIONS]).is_ok());
    }

    #[test]
    fn only_the_two_levels_can_be_asked_for() {
        assert_eq!(level_from("media"), Some(Level::Media));
        assert_eq!(level_from("full"), Some(Level::Full));
        for bad in ["off", "", "Media", "admin", "FULL"] {
            assert_eq!(level_from(bad), None, "{bad:?}");
        }
    }

    fn known(grant: Level, unlock_required: bool) -> Option<Known> {
        Some(Known {
            grant,
            unlock_required,
        })
    }

    #[test]
    fn the_mouse_level_needs_the_pcs_word_first_and_leaves_the_grant_to_the_pc() {
        // nothing known about this device yet: Medien is opened first
        assert_eq!(gate(None, None), Gate::Refuse("media-first"));
        // whatever the grant was: the PC is asked (it refuses without touching the open session),
        // and the phone is not asked for a level the PC wants no unlock for
        for grant in [Level::Off, Level::Media, Level::Full] {
            assert_eq!(gate(known(grant, false), None), Gate::Go);
        }
    }

    #[test]
    fn the_phone_is_unlocked_once_in_eight_hours() {
        let full = known(Level::Full, true);
        assert_eq!(gate(full, None), Gate::Unlock);
        assert_eq!(gate(full, Some(Duration::ZERO)), Gate::Go);
        assert_eq!(
            gate(full, Some(UNLOCK_VALID - Duration::from_secs(1))),
            Gate::Go
        );
        assert_eq!(gate(full, Some(UNLOCK_VALID)), Gate::Unlock);
        assert_eq!(UNLOCK_VALID, Duration::from_secs(8 * 3600));
    }

    #[test]
    fn a_clock_set_back_counts_as_never_unlocked() {
        let client = RemoteClient::default();
        assert_eq!(since_unlock(&client), Ok(None));
        *client.unlocked.lock().unwrap() = Some(SystemTime::now() - Duration::from_secs(60));
        assert!(since_unlock(&client).unwrap().unwrap() >= Duration::from_secs(60));
        // unlocked "in the future": the clock went back
        *client.unlocked.lock().unwrap() = Some(SystemTime::now() + Duration::from_secs(3600));
        assert_eq!(since_unlock(&client), Ok(None));
        assert_eq!(
            gate(known(Level::Full, true), since_unlock(&client).unwrap()),
            Gate::Unlock
        );
    }

    #[test]
    fn the_prompts_texts_are_fixed_here_in_two_languages() {
        let (title, subtitle) = prompt_texts(Some("de"));
        assert_eq!(title, "Handy entsperren");
        assert!(subtitle.contains("Maus und Tastatur"));
        assert_eq!(prompt_texts(Some("de-AT")), prompt_texts(Some("DE")));
        for other in [None, Some("en"), Some("fr"), Some("deutsch"), Some("")] {
            assert_eq!(prompt_texts(other).0, "Unlock phone", "{other:?}");
        }
    }

    #[test]
    fn the_prompt_flag_clears_however_the_attempt_ends() {
        let flag = AtomicBool::new(true);
        {
            let _asking = Asking(&flag);
        }
        assert!(!flag.load(Ordering::SeqCst));
    }

    #[test]
    fn the_prompts_answer_is_a_pass_only_when_it_says_so() {
        assert_eq!(unlocked_from("ok"), Ok(Unlocked::Yes));
        assert_eq!(unlocked_from("none"), Ok(Unlocked::NoLock));
        assert_eq!(unlocked_from("cancelled"), Err("unlock-cancelled"));
        for odd in ["", "OK", "invalidated", "missing", "error"] {
            assert_eq!(unlocked_from(odd), Err("unlock-failed"), "{odd:?}");
        }
    }

    #[test]
    fn what_the_pc_says_in_this_very_opened_decides_whether_the_session_is_kept() {
        let fresh = Some(Duration::from_secs(60));
        // media, or a mouse session the PC wants no unlock for: kept
        assert!(keep(Level::Media, true, None, false));
        assert!(keep(Level::Full, false, None, false));
        // the PC asks for an unlock: kept only with one inside the window …
        assert!(keep(Level::Full, true, fresh, false));
        assert!(!keep(Level::Full, true, None, false));
        assert!(!keep(Level::Full, true, Some(UNLOCK_VALID), false));
        // … or on a phone that has no lock to ask for (found by asking, in this very open)
        assert!(keep(Level::Full, true, None, true));
    }

    #[test]
    fn another_pc_starts_from_nothing() {
        let client = RemoteClient::default();
        *client.known.lock().unwrap() = known(Level::Full, false);
        *client.unlocked.lock().unwrap() = Some(SystemTime::now());
        client.locked.store(true, Ordering::SeqCst);
        client.live.store(7, Ordering::SeqCst);
        let before = client.newest.load(Ordering::SeqCst);
        client.reset();
        assert_eq!(*client.known.lock().unwrap(), None);
        assert!(client.unlocked.lock().unwrap().is_none());
        assert!(!client.locked.load(Ordering::SeqCst));
        // no session is heard any more, and a connect under way is not wanted
        assert_eq!(client.live.load(Ordering::SeqCst), 0);
        assert!(client.newest.load(Ordering::SeqCst) > before);
        assert!(client.session.lock().unwrap().is_none());
    }

    #[test]
    fn mouse_buttons_are_a_fixed_list_and_need_the_mouse_level() {
        for (name, kind) in [
            ("left-down", Kind::Press),
            ("left-up", Kind::Release),
            ("right-down", Kind::Press),
            ("right-up", Kind::Release),
        ] {
            let (record, got) = record_from(name).unwrap();
            assert!(
                got == kind && matches!(record, Record::Button { .. }),
                "{name}"
            );
        }
        assert_eq!(record_from("mute").unwrap().1, Kind::Media);
        for bad in ["middle-down", "left", "left-click", "Left-down", "x1-down"] {
            assert!(record_from(bad).is_none(), "{bad:?}");
        }
        let bundle = |names: &[&str]| {
            records_from(&names.iter().map(|n| (*n).to_owned()).collect::<Vec<_>>()).unwrap()
        };
        // a media session never sends a button, not even a release: the PC would close it
        for names in [&["left-down"][..], &["left-up"], &["next", "right-up"]] {
            assert_eq!(
                sendable(bundle(names), Level::Media, false),
                Err("bad-level")
            );
        }
        assert_eq!(
            sendable(bundle(&["next"]), Level::Media, true).unwrap(),
            [Record::Media(Media::Next)]
        );
        // the mouse level sends all of it
        assert_eq!(
            sendable(
                bundle(&["left-down", "mute", "left-up"]),
                Level::Full,
                false
            )
            .unwrap()
            .len(),
            3
        );
    }

    #[test]
    fn a_locked_pc_gets_no_press_but_always_the_release() {
        let bundle = |names: &[&str]| {
            records_from(&names.iter().map(|n| (*n).to_owned()).collect::<Vec<_>>()).unwrap()
        };
        assert_eq!(
            sendable(bundle(&["left-down", "mute", "left-up"]), Level::Full, true).unwrap(),
            [
                Record::Media(Media::MuteToggle),
                Record::Button {
                    button: Button::Left,
                    down: false
                }
            ]
        );
        assert!(sendable(bundle(&["right-down"]), Level::Full, true)
            .unwrap()
            .is_empty());
    }

    #[test]
    fn a_way_becomes_steps_and_a_long_one_is_shortened_along_its_direction() {
        assert_eq!(glide_from("move"), Some(Glide::Move));
        assert_eq!(glide_from("scroll"), Some(Glide::Scroll));
        assert_eq!(glide_from("key"), None);
        assert!(steps(Glide::Move, 0, 0).is_empty());
        assert_eq!(steps(Glide::Move, 3, -4), [Record::Move { dx: 3, dy: -4 }]);
        assert_eq!(
            steps(Glide::Scroll, 0, 2),
            [Record::Scroll { dx: 0, dy: 2 }]
        );
        // longer than one record: split, nothing of the way lost
        assert_eq!(
            steps(Glide::Move, 300, -128),
            [
                Record::Move { dx: 127, dy: -127 },
                Record::Move { dx: 127, dy: -1 },
                Record::Move { dx: 46, dy: 0 },
            ]
        );
        let sum = |records: &[Record]| {
            records.iter().fold((0i64, 0i64), |(x, y), r| match r {
                Record::Move { dx, dy } => (x + i64::from(*dx), y + i64::from(*dy)),
                _ => (x, y),
            })
        };
        let far = i64::from(STEP) * MAX_STEPS as i64;
        // never more than one frame, whatever the page hands over, and the direction holds
        for (dx, dy) in [
            (i32::MAX, i32::MIN),
            (i32::MIN, i32::MIN),
            (1_000_000, 0),
            (0, -1_000_000),
            (10_000, 5_000),
        ] {
            let cut = steps(Glide::Move, dx, dy);
            assert!(cut.len() <= MAX_STEPS, "{dx} {dy}: {}", cut.len());
            assert!(cut.len() <= ::lan_sync::input::wire::MAX_RECORDS);
            let (x, y) = sum(&cut);
            assert_eq!(x.abs().max(y.abs()), far, "{dx} {dy}");
            assert_eq!(x.signum(), i64::from(dx.signum()));
            assert_eq!(y.signum(), i64::from(dy.signum()));
        }
        assert_eq!(sum(&steps(Glide::Move, 10_000, 5_000)), (far, far / 2));
    }

    #[test]
    fn only_the_session_in_the_slot_or_the_one_being_opened_is_heard() {
        // 3 is in the slot, 4 is being opened: both are heard (a refused 4 costs 3 nothing)
        assert!(passes(3, 3, 4));
        assert!(passes(4, 3, 4));
        // an older session's late words, and a session that was closed here
        assert!(!passes(2, 3, 4));
        assert!(!passes(3, 0, 4));
        // the slot is empty and a failed attempt 4 is the newest: nothing of 3 comes through
        assert!(!passes(3, 0, 5));
        assert_eq!(
            event_dto(4, Event::Closed(Some(Code::Ended))),
            EventDto::Closed {
                session: 4,
                reason: Some("ended")
            }
        );
        assert_eq!(
            event_dto(4, Event::Closed(None)),
            EventDto::Closed {
                session: 4,
                reason: None
            }
        );
    }

    #[test]
    fn an_unknown_volume_is_no_number() {
        let unknown = state_dto(PcState::UNKNOWN);
        assert_eq!(unknown.volume, None);
        let loud = state_dto(PcState {
            volume: 100,
            mute: true,
            playing: false,
            locked: false,
        });
        assert_eq!((loud.volume, loud.mute), (Some(100), true));
    }

    #[test]
    fn every_signal_of_the_crate_has_its_own_code() {
        let errors = [
            InputError::Network,
            InputError::NoAnswer,
            InputError::UnknownDevice,
            InputError::Protocol,
            InputError::Closed,
            InputError::Refused(Code::RemoteOff),
            InputError::Refused(Code::NotGranted),
            InputError::Refused(Code::Busy),
            InputError::Refused(Code::Paused),
            InputError::Refused(Code::Locked),
            InputError::Refused(Code::Unsupported),
            InputError::Refused(Code::Ended),
            InputError::Refused(Code::Limit),
        ];
        let mut names: Vec<&str> = errors.iter().map(|e| error_name(*e)).collect();
        names.sort_unstable();
        names.dedup();
        assert_eq!(names.len(), errors.len());
    }

    #[test]
    fn a_keystore_that_does_not_answer_never_reads_as_unpaired() {
        assert_eq!(stored_error("not-paired".into()), "not-paired");
        assert_eq!(stored_error("keystore-unavailable".into()), "network");
        assert_eq!(stored_error("internal".into()), "network");
    }

    #[test]
    fn the_wire_shape_the_page_relies_on() {
        let event = EventDto::State {
            session: 7,
            state: StateDto {
                volume: Some(42),
                mute: false,
                playing: true,
                locked: false,
            },
        };
        assert_eq!(
            serde_json::to_string(&event).unwrap(),
            r#"{"kind":"state","session":7,"state":{"volume":42,"mute":false,"playing":true,"locked":false}}"#
        );
        let opened = OpenedDto {
            session: 7,
            level: level_name(Level::Media),
            grant: level_name(Level::Full),
            unlock_required: true,
            no_lock: false,
            state: state_dto(PcState::UNKNOWN),
        };
        assert_eq!(
            serde_json::to_string(&opened).unwrap(),
            r#"{"session":7,"level":"media","grant":"full","unlockRequired":true,"noLock":false,"state":{"volume":null,"mute":false,"playing":false,"locked":false}}"#
        );
        let closed = EventDto::Closed {
            session: 7,
            reason: None,
        };
        assert_eq!(
            serde_json::to_string(&closed).unwrap(),
            r#"{"kind":"closed","session":7,"reason":null}"#
        );
    }
}
