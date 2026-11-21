//! Device exchange, phone side (concept `docs/design/device-exchange/CONCEPT.md`): one exchange
//! session with the paired PC (`lan_sync::exchange_client`), opened by the web view when it wants
//! one (app in front, page open, Wi-Fi change) and kept alive by its pings.
//!
//! * What the PC sends is stored in this device's inbox file first (`crate::exchange_store`), then
//!   acked; the page hears `Received` and takes it over (`exchange_client_take`, then
//!   `exchange_client_confirm`). An id seen before is acked again without a second card.
//! * What this device sends: the page keeps it as „wartet“ until the PC's `Ack` and sends it again
//!   on the next session otherwise (the PC stores an id once).
//! * Only one session at a time; a new `open` replaces the old one. Nothing is logged.

// compiled on the desktop for the unit tests only; no command of it is registered there
#![cfg_attr(not(mobile), allow(dead_code))]

use crate::exchange_store::{hex, id_from_hex, kind_from, unix_ms, Entry, Inbox, Key};
use lan_sync::exchange::wire::{AckState, Code, Item};
use lan_sync::exchange_client::{Event, ExchangeError, ExchangeSession};
use serde::Serialize;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager as _, Runtime};

/// The session and the acks that came in before it was in the slot.
#[derive(Default)]
struct Shared {
    session: Mutex<Option<Arc<ExchangeSession>>>,
    early: Mutex<Vec<([u8; 16], AckState)>>,
}

#[derive(Default)]
pub struct ExchangeClient {
    open: Mutex<Option<(u64, Arc<Shared>)>>,
    newest: AtomicU64,
    inbox: Mutex<Option<Arc<Inbox>>>,
}

/// What the page hears. `session` tells an event of an older session apart.
#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum EventDto {
    /// Something arrived and is in the inbox.
    #[serde(rename_all = "camelCase")]
    Received { session: u64 },
    /// The PC's answer to an item of this device: `delivered` | `full` | `rejected`.
    #[serde(rename_all = "camelCase")]
    Answer {
        session: u64,
        id: String,
        state: String,
    },
    /// The session is over, with the PC's reason when it gave one.
    #[serde(rename_all = "camelCase")]
    Closed {
        session: u64,
        reason: Option<String>,
        minutes: Option<u8>,
    },
}

fn code_name(code: Code) -> (&'static str, Option<u8>) {
    match code {
        Code::ExchangeOff => ("exchange-off", None),
        Code::NotGranted => ("not-granted", None),
        Code::Paused => ("paused", None),
        Code::Limit(m) => ("limit", Some(m)),
    }
}

/// Error names for the page; `limit:<minutes>` carries the minutes left.
fn error_name(e: ExchangeError) -> String {
    match e {
        ExchangeError::Network => "network".into(),
        ExchangeError::NoAnswer => "no-answer".into(),
        ExchangeError::UnknownDevice => "unknown-device".into(),
        ExchangeError::Refused(code) => match code_name(code) {
            (name, Some(m)) => format!("{name}:{m}"),
            (name, None) => name.into(),
        },
        ExchangeError::Protocol => "protocol".into(),
        ExchangeError::Closed => "closed".into(),
    }
}

fn inbox<R: Runtime>(app: &AppHandle<R>) -> Result<Arc<Inbox>, String> {
    let state = app.state::<ExchangeClient>();
    let mut slot = state.inbox.lock().map_err(|_| "internal")?;
    if let Some(i) = slot.as_ref() {
        return Ok(i.clone());
    }
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|_| "no-data-dir")?
        .join("exchange");
    let _ = std::fs::create_dir_all(&dir);
    let opened = Arc::new(Inbox::open(&dir.join("inbox.json")));
    *slot = Some(opened.clone());
    Ok(opened)
}

fn current<R: Runtime>(app: &AppHandle<R>, session: u64) -> Result<Arc<ExchangeSession>, String> {
    let state = app.state::<ExchangeClient>();
    let open = state.open.lock().map_err(|_| "internal")?;
    match open.as_ref() {
        Some((id, shared)) if *id == session => shared
            .session
            .lock()
            .map_err(|_| "internal")?
            .clone()
            .ok_or_else(|| "closed".to_owned()),
        _ => Err("closed".to_owned()),
    }
}

/// Ends a session for good. The reader's callback holds `Shared`, and `Shared` holds the session:
/// taking it out of `Shared` breaks that cycle, so the session really closes now.
fn end(open: Option<(u64, Arc<Shared>)>) {
    if let Some((_, shared)) = open {
        let session = shared.session.lock().ok().and_then(|mut s| s.take());
        if let Some(session) = session {
            match Arc::try_unwrap(session) {
                Ok(s) => s.close(),
                // a send still holds it: dropping the last reference shuts it
                Err(s) => drop(s),
            }
        }
    }
}

fn ack(shared: &Shared, id: [u8; 16], state: AckState) {
    let Ok(slot) = shared.session.lock() else {
        return;
    };
    match slot.as_ref() {
        Some(s) => {
            let _ = s.ack(&id, state);
        }
        None => {
            if let Ok(mut early) = shared.early.lock() {
                early.push((id, state));
            }
        }
    }
}

/// Opens a session with the paired PC (replacing an open one). Returns its number.
#[tauri::command]
pub async fn exchange_client_open<R: Runtime>(
    app: AppHandle<R>,
    on_event: Channel<EventDto>,
) -> Result<u64, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<ExchangeClient>();
        let id = state.newest.fetch_add(1, Ordering::SeqCst) + 1;
        // the session this one replaces ends now
        let old = state.open.lock().ok().and_then(|mut o| o.take());
        end(old);
        let (hub, addr, name) = crate::lan_client::hub_entry(&app)?;
        let key = crate::lan_client::stored_key(&app)?;
        let inbox = inbox(&app)?;
        let shared = Arc::new(Shared::default());
        let hub_hex = hex(hub.as_bytes());
        let events = {
            let shared = shared.clone();
            let on_event = on_event.clone();
            Box::new(move |event: Event| match event {
                Event::Item(item) => {
                    let state = match inbox.store(&hub_hex, &item, unix_ms()) {
                        Ok(_) => AckState::Stored,
                        Err(_) => AckState::Refused,
                    };
                    ack(&shared, *item.id(), state);
                    if state == AckState::Stored {
                        let _ = on_event.send(EventDto::Received { session: id });
                    }
                }
                Event::Unusable(item_id) => ack(&shared, item_id, AckState::Rejected),
                Event::Ack(item_id, state) => {
                    let _ = on_event.send(EventDto::Answer {
                        session: id,
                        id: hex(&item_id),
                        state: crate::exchange_store::state_name(state).to_owned(),
                    });
                }
                Event::Closed(code) => {
                    let (reason, minutes) = match code.map(code_name) {
                        Some((name, m)) => (Some(name.to_owned()), m),
                        None => (None, None),
                    };
                    let _ = on_event.send(EventDto::Closed {
                        session: id,
                        reason,
                        minutes,
                    });
                }
                // files: this session is opened without `FEATURE_FILES`, so the PC sends none
                // (the client closes on a file frame); the phone's files come in package 2b-2
                Event::Offer(_)
                | Event::BadOffer(..)
                | Event::Accept(..)
                | Event::Wait(..)
                | Event::Refuse(..)
                | Event::Chunk(..)
                | Event::End(_)
                | Event::Result(..)
                | Event::Cancel(_) => {}
            })
        };
        let session = ExchangeSession::open(addr, &key, &hub, &name, events).map_err(error_name)?;
        let session = Arc::new(session);
        let mut open = state.open.lock().map_err(|_| "internal")?;
        // a newer `open` overtook this one while it connected
        if state.newest.load(Ordering::SeqCst) != id {
            return Err("closed".to_owned());
        }
        {
            let mut slot = shared.session.lock().map_err(|_| "internal")?;
            *slot = Some(session.clone());
            if let Ok(mut early) = shared.early.lock() {
                for (item_id, ack_state) in early.drain(..) {
                    let _ = session.ack(&item_id, ack_state);
                }
            }
        }
        *open = Some((id, shared));
        Ok(id)
    })
    .await
    .map_err(|_| "internal".to_owned())?
}

/// Sends one message or link; its answer comes as an `Answer` event.
#[tauri::command]
pub async fn exchange_client_send<R: Runtime>(
    app: AppHandle<R>,
    session: u64,
    id: String,
    kind: String,
    body: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let item = Item::new(
            id_from_hex(&id).ok_or("bad-id")?,
            kind_from(&kind).ok_or("bad-kind")?,
            body,
        )
        .map_err(|_| "bad-item")?;
        current(&app, session)?.send_item(&item).map_err(error_name)
    })
    .await
    .map_err(|_| "internal".to_owned())?
}

/// Keeps the session against the PC's idle close (at least every 60 s while it is wanted).
#[tauri::command]
pub async fn exchange_client_ping<R: Runtime>(
    app: AppHandle<R>,
    session: u64,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || current(&app, session)?.ping().map_err(error_name))
        .await
        .map_err(|_| "internal".to_owned())?
}

#[tauri::command]
pub async fn exchange_client_close<R: Runtime>(app: AppHandle<R>, session: u64) {
    let _ = tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<ExchangeClient>();
        let taken = match state.open.lock() {
            Ok(mut open) if open.as_ref().is_some_and(|(id, _)| *id == session) => open.take(),
            _ => None,
        };
        end(taken);
    })
    .await;
}

/// What arrived and is not taken over yet (off the main thread: the file can be large).
#[tauri::command]
pub async fn exchange_client_take<R: Runtime>(app: AppHandle<R>) -> Result<Vec<Entry>, String> {
    tauri::async_runtime::spawn_blocking(move || Ok(inbox(&app)?.pending()))
        .await
        .map_err(|_| "internal".to_owned())?
}

/// The page keeps these now.
#[tauri::command]
pub async fn exchange_client_confirm<R: Runtime>(
    app: AppHandle<R>,
    items: Vec<Key>,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        inbox(&app)?.confirm(&items);
        Ok(())
    })
    .await
    .map_err(|_| "internal".to_owned())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn errors_have_names_the_page_knows() {
        assert_eq!(
            error_name(ExchangeError::Refused(Code::Limit(12))),
            "limit:12"
        );
        assert_eq!(
            error_name(ExchangeError::Refused(Code::ExchangeOff)),
            "exchange-off"
        );
        assert_eq!(error_name(ExchangeError::UnknownDevice), "unknown-device");
        assert_eq!(error_name(ExchangeError::NoAnswer), "no-answer");
    }

    #[test]
    fn events_serialise_without_any_content() {
        let e = serde_json::to_string(&EventDto::Answer {
            session: 2,
            id: "ab".into(),
            state: "delivered".into(),
        })
        .unwrap();
        assert_eq!(
            e,
            r#"{"type":"answer","session":2,"id":"ab","state":"delivered"}"#
        );
        let c = serde_json::to_string(&EventDto::Closed {
            session: 1,
            reason: Some("limit".into()),
            minutes: Some(5),
        })
        .unwrap();
        assert!(c.contains(r#""type":"closed""#) && c.contains(r#""minutes":5"#));
    }
}
