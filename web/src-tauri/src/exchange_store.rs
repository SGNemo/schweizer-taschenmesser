//! Device exchange: the files that hold delivery state on this device (concept
//! `docs/design/device-exchange/CONCEPT.md` §4 "Delivery state is Rust's").
//!
//! * **Inbox**: items another device sent here, kept until the web view took them over into its
//!   history (`take`, then `confirm`). An item is acked to the sender only after it is in this
//!   file. The ids seen per device are kept two hours, also after the hand-over, so a resend after
//!   a lost ack never makes a second card (delivery is at least once).
//! * **Outbox** (the PC only): what this PC queued for a device, with the device's last answer.
//!
//! One JSON file each, replaced atomically (temp file + rename). Text bodies are user data and
//! stay in the app's own data folder; nothing here is logged or formatted for a log.

use lan_sync::exchange::wire::{AckState, Item, Kind};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

/// Items kept in the inbox before the web view took them over.
pub const INBOX_MAX: usize = 500;
/// Items queued per device in the outbox.
pub const OUTBOX_MAX_PER_DEVICE: usize = 500;
/// How long a seen id is remembered (longer than the hub's rate window of one hour).
const SEEN_SECS: u64 = 2 * 60 * 60;

pub fn unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| u64::try_from(d.as_millis()).unwrap_or(u64::MAX))
}

pub fn hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push(char::from(DIGITS[usize::from(b >> 4)]));
        s.push(char::from(DIGITS[usize::from(b & 0x0f)]));
    }
    s
}

pub fn id_from_hex(text: &str) -> Option<[u8; 16]> {
    if text.len() != 32 || !text.bytes().all(|b| b.is_ascii_hexdigit()) {
        return None;
    }
    let mut out = [0u8; 16];
    for (i, chunk) in text.as_bytes().chunks(2).enumerate() {
        out[i] = u8::from_str_radix(std::str::from_utf8(chunk).ok()?, 16).ok()?;
    }
    Some(out)
}

pub fn kind_name(kind: Kind) -> &'static str {
    match kind {
        Kind::Text => "text",
        Kind::Link => "link",
        Kind::Clip => "clip",
    }
}

pub fn kind_from(name: &str) -> Option<Kind> {
    match name {
        "text" => Some(Kind::Text),
        "link" => Some(Kind::Link),
        "clip" => Some(Kind::Clip),
        _ => None,
    }
}

pub fn state_name(state: AckState) -> &'static str {
    match state {
        AckState::Stored => "delivered",
        AckState::Refused => "full",
        AckState::Rejected => "rejected",
    }
}

/// One item as the web view sees it. `peer` is the other device's key (hex), `id` the item's.
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub peer: String,
    pub id: String,
    pub kind: String,
    pub body: String,
    pub at: u64,
}

impl std::fmt::Debug for Entry {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Entry(..)")
    }
}

impl Entry {
    pub fn of(peer: &str, item: &Item, at: u64) -> Entry {
        Entry {
            peer: peer.to_owned(),
            id: hex(item.id()),
            kind: kind_name(item.kind()).to_owned(),
            body: item.body().to_owned(),
            at,
        }
    }

    /// The checked item, or `None` (a broken file entry is skipped, never sent).
    pub fn item(&self) -> Option<Item> {
        Item::new(
            id_from_hex(&self.id)?,
            kind_from(&self.kind)?,
            self.body.clone(),
        )
        .ok()
    }
}

/// Why the inbox did not take an item.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InboxError {
    Full,
}

/// What `store` did.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StoreResult {
    New,
    Known,
}

#[derive(Default, Serialize, Deserialize)]
struct InboxFile {
    v: u8,
    items: Vec<Entry>,
    /// peer → (id, unix seconds when seen)
    seen: HashMap<String, VecDeque<(String, u64)>>,
}

pub struct Inbox {
    path: PathBuf,
    state: Mutex<InboxFile>,
}

fn read_json<T: Default + for<'de> Deserialize<'de>>(path: &Path) -> T {
    // a missing or broken file starts empty: these files hold no settings, only items in transit
    std::fs::read(path)
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

fn write_json<T: Serialize>(path: &Path, value: &T) -> std::io::Result<()> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    let bytes = serde_json::to_vec(value).map_err(std::io::Error::other)?;
    let mut tmp = path.as_os_str().to_owned();
    tmp.push(".tmp");
    std::fs::write(&tmp, bytes)?;
    std::fs::rename(&tmp, path)
}

impl Inbox {
    pub fn open(path: &Path) -> Inbox {
        let mut file: InboxFile = read_json(path);
        file.v = 1;
        Inbox {
            path: path.to_owned(),
            state: Mutex::new(file),
        }
    }

    /// Keeps the item unless its id was seen from that device; `Full` when it cannot be written
    /// (nothing is acked then).
    pub fn store(&self, peer: &str, item: &Item, now_ms: u64) -> Result<StoreResult, InboxError> {
        let mut file = self.state.lock().map_err(|_| InboxError::Full)?;
        let now_s = now_ms / 1000;
        let id = hex(item.id());
        let seen = file.seen.entry(peer.to_owned()).or_default();
        while seen
            .front()
            .is_some_and(|(_, at)| now_s.saturating_sub(*at) >= SEEN_SECS)
        {
            seen.pop_front();
        }
        if seen.iter().any(|(s, _)| *s == id) {
            return Ok(StoreResult::Known);
        }
        if file.items.len() >= INBOX_MAX {
            return Err(InboxError::Full);
        }
        file.items.push(Entry::of(peer, item, now_ms));
        file.seen
            .entry(peer.to_owned())
            .or_default()
            .push_back((id, now_s));
        if write_json(&self.path, &*file).is_err() {
            // not on disk: not stored, not acked (the sender keeps it)
            file.items.pop();
            if let Some(s) = file.seen.get_mut(peer) {
                s.pop_back();
            }
            return Err(InboxError::Full);
        }
        Ok(StoreResult::New)
    }

    /// Everything waiting for the web view (it stays until `confirm`).
    pub fn pending(&self) -> Vec<Entry> {
        self.state
            .lock()
            .map(|f| f.items.clone())
            .unwrap_or_default()
    }

    /// The web view keeps these now; they leave the inbox (their ids stay seen).
    pub fn confirm(&self, ids: &[String]) {
        if let Ok(mut file) = self.state.lock() {
            file.items.retain(|e| !ids.contains(&e.id));
            let _ = write_json(&self.path, &*file);
        }
    }
}

/// One queued item and the device's last answer.
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OutEntry {
    entry: Entry,
    /// `queued`, or `full` after the device said it has no room.
    state: String,
}

#[derive(Default, Serialize, Deserialize)]
struct OutboxFile {
    v: u8,
    queue: Vec<OutEntry>,
}

/// The device's answer to an item, for the web view.
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Answer {
    pub peer: String,
    pub id: String,
    /// `delivered` | `full` | `rejected`
    pub state: String,
}

pub struct Outbox {
    path: PathBuf,
    state: Mutex<OutboxFile>,
    /// Answers the web view has not read yet (memory only: the web view also reads the queue).
    answers: Mutex<Vec<Answer>>,
}

impl Outbox {
    pub fn open(path: &Path) -> Outbox {
        let mut file: OutboxFile = read_json(path);
        file.v = 1;
        // a broken entry never goes out
        file.queue.retain(|e| e.entry.item().is_some());
        Outbox {
            path: path.to_owned(),
            state: Mutex::new(file),
            answers: Mutex::new(Vec::new()),
        }
    }

    /// Queues an item for `peer`. `Err` when the queue is full or the file cannot be written.
    pub fn push(&self, peer: &str, item: &Item, now_ms: u64) -> Result<(), String> {
        let mut file = self.state.lock().map_err(|_| "internal")?;
        let queued = file.queue.iter().filter(|e| e.entry.peer == peer).count();
        if queued >= OUTBOX_MAX_PER_DEVICE {
            return Err("outbox-full".to_owned());
        }
        if file.queue.iter().any(|e| e.entry.id == hex(item.id())) {
            return Ok(());
        }
        file.queue.push(OutEntry {
            entry: Entry::of(peer, item, now_ms),
            state: "queued".to_owned(),
        });
        if write_json(&self.path, &*file).is_err() {
            file.queue.pop();
            return Err("storage".to_owned());
        }
        Ok(())
    }

    /// The oldest item for `peer` (from memory).
    pub fn next_for(&self, peer: &str) -> Option<Item> {
        let file = self.state.lock().ok()?;
        file.queue
            .iter()
            .find(|e| e.entry.peer == peer)
            .and_then(|e| e.entry.item())
    }

    /// The device answered: delivered and rejected leave the queue (from memory even if the file
    /// cannot be written), full stays.
    pub fn answer(&self, peer: &str, id: &[u8; 16], state: AckState) {
        let id = hex(id);
        if let Ok(mut file) = self.state.lock() {
            match state {
                AckState::Refused => {
                    for e in file.queue.iter_mut().filter(|e| e.entry.id == id) {
                        e.state = "full".to_owned();
                    }
                }
                AckState::Stored | AckState::Rejected => {
                    file.queue.retain(|e| e.entry.id != id);
                }
            }
            let _ = write_json(&self.path, &*file);
        }
        if let Ok(mut answers) = self.answers.lock() {
            answers.push(Answer {
                peer: peer.to_owned(),
                id,
                state: state_name(state).to_owned(),
            });
        }
    }

    /// What is still queued: (peer, id, `queued` | `full`).
    pub fn queued(&self) -> Vec<(String, String, String)> {
        self.state
            .lock()
            .map(|f| {
                f.queue
                    .iter()
                    .map(|e| (e.entry.peer.clone(), e.entry.id.clone(), e.state.clone()))
                    .collect()
            })
            .unwrap_or_default()
    }

    /// The answers since the last call.
    pub fn take_answers(&self) -> Vec<Answer> {
        self.answers
            .lock()
            .map(|mut a| std::mem::take(&mut *a))
            .unwrap_or_default()
    }

    /// A device was unpaired: its queue goes.
    pub fn forget(&self, peer: &str) {
        if let Ok(mut file) = self.state.lock() {
            file.queue.retain(|e| e.entry.peer != peer);
            let _ = write_json(&self.path, &*file);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dir(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("nemo-exchange-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    fn item(n: u8, body: &str) -> Item {
        Item::new([n; 16], Kind::Text, body.to_owned()).unwrap()
    }

    #[test]
    fn the_inbox_keeps_items_across_a_restart_and_a_resend_after_the_hand_over_is_known() {
        let d = dir("inbox");
        let path = d.join("inbox.json");
        let inbox = Inbox::open(&path);
        assert_eq!(
            inbox.store("aa", &item(1, "x"), 1_000),
            Ok(StoreResult::New)
        );
        assert_eq!(
            inbox.store("aa", &item(1, "x"), 2_000),
            Ok(StoreResult::Known)
        );
        // another device may use the same id
        assert_eq!(
            inbox.store("bb", &item(1, "y"), 2_000),
            Ok(StoreResult::New)
        );
        let inbox = Inbox::open(&path);
        assert_eq!(inbox.pending().len(), 2);
        inbox.confirm(&[hex(&[1; 16])]);
        assert!(inbox.pending().is_empty());
        // taken over by the web view, the id is still seen: no second card
        assert_eq!(
            inbox.store("aa", &item(1, "x"), 3_000),
            Ok(StoreResult::Known)
        );
        // after the seen window it is new again
        let later = 3_000 + (SEEN_SECS + 1) * 1000;
        assert_eq!(
            inbox.store("aa", &item(1, "x"), later),
            Ok(StoreResult::New)
        );
    }

    #[test]
    fn a_full_inbox_takes_nothing_more() {
        let d = dir("full");
        let inbox = Inbox::open(&d.join("inbox.json"));
        for n in 0..INBOX_MAX {
            let mut id = [0u8; 16];
            id[..8].copy_from_slice(&(n as u64).to_be_bytes());
            let i = Item::new(id, Kind::Text, "x".into()).unwrap();
            assert_eq!(inbox.store("aa", &i, 1), Ok(StoreResult::New));
        }
        assert_eq!(
            inbox.store("aa", &item(0xff, "x"), 1),
            Err(InboxError::Full)
        );
    }

    #[test]
    fn the_outbox_survives_a_restart_and_answers_take_items_out_or_mark_them_full() {
        let d = dir("outbox");
        let path = d.join("outbox.json");
        let out = Outbox::open(&path);
        out.push("aa", &item(1, "eins"), 1).unwrap();
        out.push("aa", &item(2, "zwei"), 2).unwrap();
        out.push("bb", &item(3, "drei"), 3).unwrap();
        let out = Outbox::open(&path);
        assert_eq!(out.next_for("aa").unwrap().id(), &[1; 16]);
        out.answer("aa", &[1; 16], AckState::Stored);
        assert_eq!(out.next_for("aa").unwrap().id(), &[2; 16]);
        out.answer("aa", &[2; 16], AckState::Refused);
        assert_eq!(out.next_for("aa").unwrap().id(), &[2; 16], "full stays");
        out.answer("aa", &[2; 16], AckState::Rejected);
        assert!(out.next_for("aa").is_none());
        let answers = out.take_answers();
        assert_eq!(
            answers.iter().map(|a| a.state.as_str()).collect::<Vec<_>>(),
            ["delivered", "full", "rejected"]
        );
        assert!(out.take_answers().is_empty());
        out.forget("bb");
        assert!(out.queued().is_empty());
    }

    #[test]
    fn ids_parse_only_as_32_hex_digits() {
        assert_eq!(id_from_hex(&hex(&[0xab; 16])), Some([0xab; 16]));
        assert_eq!(id_from_hex("../../x"), None);
        assert_eq!(id_from_hex(&"g".repeat(32)), None);
        assert!(format!("{:?}", Entry::of("aa", &item(1, "geheim"), 1)) == "Entry(..)");
    }
}
