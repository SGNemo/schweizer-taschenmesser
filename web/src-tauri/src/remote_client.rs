//! Remote control, phone side: one input session with the paired PC. Thin glue around
//! `lan_sync::input_client` (tested there); rules in `docs/rules/remote-control.md`.
//!
//! * A connection of its own, never the sync client's `Link`: input does not wait for a sync round
//!   and the two share no frame. The device key and the pinned hub are the ones of
//!   `lan_client.rs`; both stay in Rust, the page gets neither.
//! * The phone decides nothing: what this device may do is checked by the PC for every session
//!   and every frame. This file only passes on what the page asks for – from a fixed list of media
//!   actions – and what the PC answers.
//! * One session at a time. Opening a new one closes the old one; events of a replaced session
//!   are dropped here, so the page never sees a late "closed" of a session it already left.
//! * Never unpairs: an `unknown-device` from the PC is only reported (see the header of
//!   `input_client.rs`). Whether the device is still paired is what a sync round says.
//! * Phone only: the commands are registered in the mobile handler and granted in
//!   `capabilities/mobile.json` alone. Nothing here logs; errors are short codes.

// Only the phone registers these commands; the desktop build compiles this file for its unit
// tests alone.
#![cfg_attr(not(mobile), allow(dead_code))]

use ::lan_sync::input::wire::{Code, Level, Media, PcState, Record, VOLUME_UNKNOWN};
use ::lan_sync::input_client::{Event, InputError, InputSession};
use serde::Serialize;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, Runtime};

/// Most actions the page may hand over in one call (a held volume key sends one at a time).
const MAX_ACTIONS: usize = 8;

#[derive(Default)]
pub struct RemoteClient {
    /// The open session and its number. The number tells a late event or a late `send` of an
    /// older session apart from the current one.
    session: Mutex<Option<(u64, Arc<InputSession>)>>,
    /// The number of the newest `open` asked for (also while it still connects).
    newest: Arc<AtomicU64>,
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
    /// What this session may do (only `media` in this package).
    level: &'static str,
    /// What the PC grants this device at most.
    grant: &'static str,
    unlock_required: bool,
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

/// The level a session may be asked for. Only `media` until this file can send pointer and key
/// records: a mouse/keyboard session that can send nothing would still show as one at the PC and
/// block its confirmations.
fn level_from(name: &str) -> Option<Level> {
    match name {
        "media" => Some(Level::Media),
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

/// The fixed list of things the page may ask for in this package. There is no "any key".
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

fn records_from(actions: &[String]) -> Result<Vec<Record>, &'static str> {
    if actions.is_empty() || actions.len() > MAX_ACTIONS {
        return Err("bad-action");
    }
    actions
        .iter()
        .map(|a| media_from(a).map(Record::Media).ok_or("bad-action"))
        .collect()
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

/// Opens an input session with the paired PC at `level` (only `media` in this package). An older session of
/// this device is closed first. The answer says what the session may really do and the PC's
/// state; later states and the end of the session arrive on `on_event`.
#[tauri::command]
pub async fn remote_client_open<R: Runtime>(
    app: AppHandle<R>,
    level: String,
    on_event: Channel<EventDto>,
) -> Result<OpenedDto, String> {
    let level = level_from(&level).ok_or("bad-level")?;
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<RemoteClient>();
        let id = state.newest.fetch_add(1, Ordering::SeqCst) + 1;
        // the session this one replaces ends now (its late events are dropped by their number)
        let old = state.session.lock().map_err(|_| "internal")?.take();
        if let Some((_, session)) = old {
            end(session);
        }
        let (hub, addr, name) = crate::lan_client::hub_entry(&app).map_err(stored_error)?;
        let key = crate::lan_client::stored_key(&app).map_err(stored_error)?;
        let newest = state.newest.clone();
        let (session, opened) = InputSession::open(
            addr,
            &key,
            &hub,
            &name,
            level,
            Box::new(move |event| {
                if let Some(dto) = event_dto(id, newest.load(Ordering::SeqCst), event) {
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
        *slot = Some((id, Arc::new(session)));
        Ok(OpenedDto {
            session: id,
            level: level_name(opened.level),
            grant: level_name(opened.grant),
            unlock_required: opened.unlock_required,
            state: state_dto(opened.state),
        })
    })
    .await
    .map_err(|_| "internal".to_owned())?
}

/// Sends a small bundle of media actions on session `session`. `closed`: that session is over
/// (open again); never a state to show by itself.
#[tauri::command]
pub async fn remote_client_send<R: Runtime>(
    app: AppHandle<R>,
    session: u64,
    actions: Vec<String>,
) -> Result<(), String> {
    let records = records_from(&actions)?;
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<RemoteClient>();
        // the lock is held only to pick the session: a write that stalls (the PC vanished)
        // must not keep `open` and `close` waiting
        let open = {
            let slot = state.session.lock().map_err(|_| "internal")?;
            match slot.as_ref() {
                Some((id, open)) if *id == session => open.clone(),
                _ => return Err("closed".to_owned()),
            }
        };
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
        if slot.as_ref().is_some_and(|(id, _)| *id == session) {
            if let Some((_, open)) = slot.take() {
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
    fn only_a_media_session_can_be_asked_for() {
        assert_eq!(level_from("media"), Some(Level::Media));
        for bad in ["full", "off", "", "Media", "admin"] {
            assert_eq!(level_from(bad), None, "{bad:?}");
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
            state: state_dto(PcState::UNKNOWN),
        };
        assert_eq!(
            serde_json::to_string(&opened).unwrap(),
            r#"{"session":7,"level":"media","grant":"full","unlockRequired":true,"state":{"volume":null,"mute":false,"playing":false,"locked":false}}"#
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
