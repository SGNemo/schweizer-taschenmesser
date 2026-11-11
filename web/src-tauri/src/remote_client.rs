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
//! * Two levels. `media` is asked for as before. `full` (mouse) is opened only when the PC said
//!   in its last `opened` that this device is granted it; if the PC asks for it, the phone is
//!   unlocked first – natively, from here, not by the page – and that holds for eight hours while
//!   the app runs (process memory only). The unlock is a brake on a phone lying around unlocked,
//!   not a proof to the PC. The media session stays open until the unlock succeeded.
//! * While the PC is locked no pointer and no button is sent (the PC would drop them and count
//!   them against the session).
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
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
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
/// Longest text of the unlock prompt (it comes from the page's translations).
const PROMPT_MAX_CHARS: usize = 120;

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
    /// The number of the newest `open` asked for (also while it still connects).
    newest: Arc<AtomicU64>,
    /// `None` until a session was opened in this run.
    known: Mutex<Option<Known>>,
    /// The PC said it is locked (its latest state): no pointer, no button.
    locked: Arc<AtomicBool>,
    /// When the phone was last unlocked for the mouse level.
    unlocked: Mutex<Option<Instant>>,
}

/// The texts of the unlock prompt, from the page's translations (the plugin has none).
#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PromptDto {
    title: String,
    subtitle: String,
    cancel: String,
}

fn prompt_ok(p: &PromptDto) -> bool {
    [&p.title, &p.subtitle, &p.cancel].into_iter().all(|t| {
        !t.trim().is_empty()
            && t.chars().count() <= PROMPT_MAX_CHARS
            && !t.chars().any(char::is_control)
    })
}

/// What an `open` at the mouse level does first.
#[derive(Debug, PartialEq, Eq)]
enum Gate {
    Go,
    /// Ask at the phone, then go.
    Unlock,
    Refuse(&'static str),
}

/// Decides from what the PC said last and from how long ago the phone was unlocked. Nothing is
/// asked and no session is touched for a device the PC does not grant the level.
fn gate(known: Option<Known>, since_unlock: Option<Duration>) -> Gate {
    match known {
        // the page opens Medien first; without that nothing is known about this device
        None => Gate::Refuse("media-first"),
        Some(k) if k.grant != Level::Full => Gate::Refuse("not-granted"),
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
    /// The phone has no lock this app can ask for: the session opens all the same and the page
    /// says so (a hint, not a block).
    NoLock,
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

/// One action of the page as a record; `true` = it needs the mouse level.
fn record_from(name: &str) -> Option<(Record, bool)> {
    if let Some(media) = media_from(name) {
        return Some((Record::Media(media), false));
    }
    let (button, down) = button_from(name)?;
    Some((Record::Button { button, down }, true))
}

fn records_from(actions: &[String]) -> Result<Vec<(Record, bool)>, &'static str> {
    if actions.is_empty() || actions.len() > MAX_ACTIONS {
        return Err("bad-action");
    }
    actions
        .iter()
        .map(|a| record_from(a).ok_or("bad-action"))
        .collect()
}

/// What of a bundle goes out on a session of `level`, with the PC locked or not. A mouse action
/// on a media session is refused whole (the PC would close the session for it); with the PC
/// locked the mouse actions are left out and the media ones still go.
fn sendable(
    records: Vec<(Record, bool)>,
    level: Level,
    pc_locked: bool,
) -> Result<Vec<Record>, &'static str> {
    if level != Level::Full && records.iter().any(|(_, mouse)| *mouse) {
        return Err("bad-level");
    }
    Ok(records
        .into_iter()
        .filter(|(_, mouse)| !(*mouse && pc_locked))
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
/// frame); what is longer is cut, never queued. Nothing for no way at all.
fn steps(kind: Glide, dx: i32, dy: i32) -> Vec<Record> {
    let far = STEP * MAX_STEPS as i32;
    let (mut x, mut y) = (dx.clamp(-far, far), dy.clamp(-far, far));
    let mut out = Vec::new();
    while (x != 0 || y != 0) && out.len() < MAX_STEPS {
        let (sx, sy) = (x.clamp(-STEP, STEP), y.clamp(-STEP, STEP));
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

/// What an event of session `id` becomes for the page; `None` once a newer session was asked for.
fn event_dto(id: u64, newest: u64, event: Event) -> Option<EventDto> {
    if id != newest {
        return None;
    }
    Some(match event {
        Event::State(state) => EventDto::State {
            session: id,
            state: state_dto(state),
        },
        Event::Closed(code) => EventDto::Closed {
            session: id,
            reason: code.map(reason_name),
        },
    })
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

/// Asks at the phone, natively: the biometric prompt of the secure-store plugin over a value
/// that only Rust can name. The first time it seals that value, later it opens it – either way
/// the person has to prove they are there. A phone without such a lock is not blocked.
///
/// Compiled on every target (the plugin has the same face everywhere), so the desktop's checks
/// see this code too; only the phone ever calls it.
async fn native_unlock<R: Runtime>(
    app: &AppHandle<R>,
    prompt: &PromptDto,
) -> Result<Unlocked, &'static str> {
    use base64::engine::general_purpose::STANDARD;
    use base64::Engine as _;
    use tauri_plugin_secure_store::{NameRequest, SealRequest, SecureStoreExt, UnsealRequest};
    /// Under the Rust-only prefix: no command of the page can read, open or delete it.
    const NAME: &str = "lan-client:remote-unlock";
    let store = app.secure_store();
    if !store.available().map(|a| a.biometric).unwrap_or(false) {
        return Ok(Unlocked::NoLock);
    }
    let present = store
        .biometric_has(NameRequest {
            name: NAME.to_owned(),
        })
        .map(|h| h.present)
        .unwrap_or(false);
    if present {
        let opened = store
            .biometric_unseal(UnsealRequest {
                name: NAME.to_owned(),
                title: prompt.title.clone(),
                subtitle: prompt.subtitle.clone(),
                cancel: prompt.cancel.clone(),
            })
            .await
            .map_err(|_| "unlock-failed")?;
        match opened.status.as_str() {
            "ok" => return Ok(Unlocked::Yes),
            "cancelled" => return Err("unlock-cancelled"),
            // missing or no longer openable (a fingerprint was added): sealed anew below
            _ => {}
        }
    }
    match store
        .biometric_seal(SealRequest {
            name: NAME.to_owned(),
            // nothing secret: the value only exists so that opening it asks the person
            secret: STANDARD.encode([1u8]),
            title: prompt.title.clone(),
            subtitle: prompt.subtitle.clone(),
            cancel: prompt.cancel.clone(),
        })
        .await
    {
        Ok(()) => Ok(Unlocked::Yes),
        // the plugin rejects a dismissed prompt with this word
        Err(e) if e.to_string().contains("cancelled") => Err("unlock-cancelled"),
        Err(_) => Err("unlock-failed"),
    }
}

/// Before a session of the mouse level: is this device granted it, and does the phone have to
/// be unlocked first? Touches no session. `Ok(true)` = the PC asks for an unlock and this phone
/// has no lock to ask for.
async fn pass_gate<R: Runtime>(
    app: &AppHandle<R>,
    prompt: Option<&PromptDto>,
) -> Result<bool, String> {
    let state = app.state::<RemoteClient>();
    let known = *state.known.lock().map_err(|_| "internal")?;
    let since = state
        .unlocked
        .lock()
        .map_err(|_| "internal")?
        .map(|at| at.elapsed());
    match gate(known, since) {
        Gate::Go => Ok(false),
        Gate::Refuse(code) => Err(code.to_owned()),
        Gate::Unlock => {
            let prompt = prompt.filter(|p| prompt_ok(p)).ok_or("bad-prompt")?;
            match native_unlock(app, prompt).await? {
                Unlocked::Yes => {
                    *state.unlocked.lock().map_err(|_| "internal")? = Some(Instant::now());
                    Ok(false)
                }
                Unlocked::NoLock => Ok(true),
            }
        }
    }
}

/// Opens an input session with the paired PC at `level` (`media` or `full`). An older session of
/// this device is closed first – for `full` only after the gate was passed, so Medien keeps
/// working while the phone asks. The answer says what the session may really do and the PC's
/// state; later states and the end of the session arrive on `on_event`. `prompt` = the texts of
/// the unlock prompt (needed for `full`).
#[tauri::command]
pub async fn remote_client_open<R: Runtime>(
    app: AppHandle<R>,
    level: String,
    prompt: Option<PromptDto>,
    on_event: Channel<EventDto>,
) -> Result<OpenedDto, String> {
    let level = level_from(&level).ok_or("bad-level")?;
    let no_lock = if level == Level::Full {
        pass_gate(&app, prompt.as_ref()).await?
    } else {
        false
    };
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<RemoteClient>();
        let id = state.newest.fetch_add(1, Ordering::SeqCst) + 1;
        // the session this one replaces ends now (its late events are dropped by their number)
        let old = state.session.lock().map_err(|_| "internal")?.take();
        if let Some((_, session, _)) = old {
            end(session);
        }
        let (hub, addr, name) = crate::lan_client::hub_entry(&app).map_err(stored_error)?;
        let key = crate::lan_client::stored_key(&app).map_err(stored_error)?;
        let newest = state.newest.clone();
        let locked = state.locked.clone();
        let (session, opened) = InputSession::open(
            addr,
            &key,
            &hub,
            &name,
            level,
            Box::new(move |event| {
                let current = newest.load(Ordering::SeqCst);
                if id == current {
                    if let Event::State(pc) = &event {
                        locked.store(pc.locked, Ordering::SeqCst);
                    }
                }
                if let Some(dto) = event_dto(id, current, event) {
                    let _ = on_event.send(dto);
                }
            }),
        )
        .map_err(|e| error_name(e).to_owned())?;
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
        state.locked.store(opened.state.locked, Ordering::SeqCst);
        *slot = Some((id, Arc::new(session), opened.level));
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
    fn the_mouse_level_needs_the_pcs_word_first_and_asks_nothing_without_a_grant() {
        // nothing known about this device yet: Medien is opened first
        assert_eq!(gate(None, None), Gate::Refuse("media-first"));
        // a media grant: no prompt, no reopening – the page shows its sentence from `grant`
        for unlock in [true, false] {
            assert_eq!(
                gate(known(Level::Media, unlock), None),
                Gate::Refuse("not-granted")
            );
            assert_eq!(
                gate(known(Level::Off, unlock), None),
                Gate::Refuse("not-granted")
            );
        }
        // granted, and the PC does not ask for an unlock
        assert_eq!(gate(known(Level::Full, false), None), Gate::Go);
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
        // an unlock from before does not open anything for a device without the grant
        assert_eq!(
            gate(known(Level::Media, true), Some(Duration::ZERO)),
            Gate::Refuse("not-granted")
        );
    }

    #[test]
    fn the_prompt_takes_short_plain_texts_only() {
        let p = |title: &str| PromptDto {
            title: title.to_owned(),
            subtitle: "Für Maus und Tastatur".to_owned(),
            cancel: "Abbrechen".to_owned(),
        };
        assert!(prompt_ok(&p("Handy entsperren")));
        assert!(!prompt_ok(&p("")));
        assert!(!prompt_ok(&p("   ")));
        assert!(!prompt_ok(&p("a\nb")));
        assert!(!prompt_ok(&p(&"x".repeat(PROMPT_MAX_CHARS + 1))));
        assert!(prompt_ok(&p(&"ä".repeat(PROMPT_MAX_CHARS))));
        // unknown fields are refused, not ignored
        assert!(serde_json::from_str::<PromptDto>(
            r#"{"title":"a","subtitle":"b","cancel":"c","extra":1}"#
        )
        .is_err());
    }

    #[test]
    fn mouse_buttons_are_a_fixed_list_and_need_the_mouse_level() {
        let all = ["left-down", "left-up", "right-down", "right-up"];
        for name in all {
            let (record, mouse) = record_from(name).unwrap();
            assert!(mouse && matches!(record, Record::Button { .. }), "{name}");
        }
        for bad in ["middle-down", "left", "left-click", "Left-down", "x1-down"] {
            assert!(record_from(bad).is_none(), "{bad:?}");
        }
        let bundle = |names: &[&str]| {
            records_from(&names.iter().map(|n| (*n).to_owned()).collect::<Vec<_>>())
        };
        // a media session never sends a button: the PC would close it for that
        assert_eq!(
            sendable(bundle(&["left-down"]).unwrap(), Level::Media, false),
            Err("bad-level")
        );
        assert_eq!(
            sendable(bundle(&["next", "left-up"]).unwrap(), Level::Media, false),
            Err("bad-level")
        );
        assert_eq!(
            sendable(bundle(&["next"]).unwrap(), Level::Media, true).unwrap(),
            [Record::Media(Media::Next)]
        );
        // the mouse level sends both …
        assert_eq!(
            sendable(bundle(&["left-down", "mute"]).unwrap(), Level::Full, false)
                .unwrap()
                .len(),
            2
        );
        // … and with the PC locked only the media action
        assert_eq!(
            sendable(bundle(&["left-down", "mute"]).unwrap(), Level::Full, true).unwrap(),
            [Record::Media(Media::MuteToggle)]
        );
        assert!(sendable(bundle(&["left-up"]).unwrap(), Level::Full, true)
            .unwrap()
            .is_empty());
    }

    #[test]
    fn a_way_becomes_steps_and_a_long_one_is_cut() {
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
        let far = steps(Glide::Move, 300, -128);
        assert_eq!(
            far,
            [
                Record::Move { dx: 127, dy: -127 },
                Record::Move { dx: 127, dy: -1 },
                Record::Move { dx: 46, dy: 0 },
            ]
        );
        // never more than one frame, whatever the page hands over
        for (dx, dy) in [(i32::MAX, i32::MIN), (1_000_000, 0), (0, -1_000_000)] {
            let cut = steps(Glide::Move, dx, dy);
            assert_eq!(cut.len(), MAX_STEPS);
            assert!(cut.len() <= ::lan_sync::input::wire::MAX_RECORDS);
        }
    }

    #[test]
    fn events_of_a_replaced_session_are_dropped() {
        let state = PcState {
            volume: 42,
            mute: false,
            playing: true,
            locked: false,
        };
        assert_eq!(event_dto(3, 4, Event::State(state)), None);
        assert_eq!(event_dto(3, 4, Event::Closed(None)), None);
        assert_eq!(
            event_dto(4, 4, Event::Closed(Some(Code::Ended))),
            Some(EventDto::Closed {
                session: 4,
                reason: Some("ended")
            })
        );
        assert_eq!(
            event_dto(4, 4, Event::Closed(None)),
            Some(EventDto::Closed {
                session: 4,
                reason: None
            })
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
