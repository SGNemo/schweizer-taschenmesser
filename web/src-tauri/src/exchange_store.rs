//! Device exchange: the files that hold delivery state on this device (concept
//! `docs/design/device-exchange/CONCEPT.md` §4 "Delivery state is Rust's").
//!
//! * **Inbox**: items another device sent here, kept until the web view took them over into its
//!   history (`pending`, then `confirm`). An item is acked to the sender only after it is in this
//!   file. The ids seen per device are kept two hours, also after the hand-over, so a resend after
//!   a lost ack never makes a second card (delivery is at least once).
//! * **Outbox** (the PC only): what this PC queued for a device, and the devices' answers until the
//!   web view confirmed them (so a restart never loses whether an item arrived or was rejected).
//!
//! Everything is keyed by (device, id): two devices may use the same id. One JSON file each,
//! written to a temp file, synced, then renamed. A file that exists but cannot be read is moved
//! aside (`*.broken`), never overwritten. Text bodies are user data and stay in the app's own data
//! folder; nothing here is logged or formatted for a log.
#![cfg_attr(mobile, allow(dead_code))]

use lan_sync::exchange::wire::{AckState, Item, Kind};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::io::Write as _;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

/// Items kept in the inbox before the web view took them over.
pub const INBOX_MAX: usize = 500;
/// Items queued per device in the outbox.
pub const OUTBOX_MAX_PER_DEVICE: usize = 500;
/// New items one device may leave here per hour and per day (E1, E2). Kept in the file, so a
/// restart does not reset them – on the PC and on the phone alike.
pub const PER_DEVICE_HOUR: usize = 300;
pub const PER_DEVICE_DAY: usize = 1_000;
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

/// A (device, id) pair the web view names.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Key {
    pub peer: String,
    pub id: String,
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

/// Reads a JSON file. Missing: empty. Present but unreadable: moved aside to `*.broken` (never
/// overwritten), then empty.
fn read_json<T: Default + for<'de> Deserialize<'de>>(path: &Path) -> T {
    match std::fs::read(path) {
        Ok(bytes) => match serde_json::from_slice(&bytes) {
            Ok(value) => value,
            Err(_) => {
                let mut aside = path.as_os_str().to_owned();
                aside.push(".broken");
                let _ = std::fs::rename(path, aside);
                T::default()
            }
        },
        Err(_) => T::default(),
    }
}

/// Temp file, synced to disk, then renamed over the file (and the folder synced where possible):
/// what is acked is on disk.
fn write_json<T: Serialize>(path: &Path, value: &T) -> std::io::Result<()> {
    let dir = path.parent().unwrap_or_else(|| Path::new("."));
    std::fs::create_dir_all(dir)?;
    let bytes = serde_json::to_vec(value).map_err(std::io::Error::other)?;
    let mut tmp = path.as_os_str().to_owned();
    tmp.push(".tmp");
    {
        let mut f = std::fs::File::create(&tmp)?;
        f.write_all(&bytes)?;
        f.sync_all()?;
    }
    std::fs::rename(&tmp, path)?;
    #[cfg(unix)]
    if let Ok(d) = std::fs::File::open(dir) {
        let _ = d.sync_all();
    }
    Ok(())
}

#[derive(Default, Serialize, Deserialize)]
#[serde(default)]
struct InboxFile {
    v: u8,
    items: Vec<Entry>,
    /// peer → (id, unix seconds when seen)
    seen: HashMap<String, VecDeque<(String, u64)>>,
    /// peer → (day = unix seconds / 86400, new items that day): the daily limit (E1, E2). Files from
    /// before it have none.
    #[serde(default)]
    today: HashMap<String, (u64, usize)>,
}

pub struct Inbox {
    path: PathBuf,
    state: Mutex<InboxFile>,
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
        // E1/E2: the device's own hour and day, from what this file remembers (survives a restart)
        let last_hour = file.seen.get(peer).map_or(0, |s| {
            s.iter()
                .filter(|(_, at)| now_s.saturating_sub(*at) < 3_600)
                .count()
        });
        let day = now_s / 86_400;
        let before = file.today.get(peer).copied();
        let used = before.filter(|(d, _)| *d == day).map_or(0, |(_, n)| n);
        if last_hour >= PER_DEVICE_HOUR || used >= PER_DEVICE_DAY {
            return Err(InboxError::Full);
        }
        file.today.insert(peer.to_owned(), (day, used + 1));
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
            match before {
                Some(b) => file.today.insert(peer.to_owned(), b),
                None => file.today.remove(peer),
            };
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

    /// The web view keeps these now; they leave the inbox (their ids stay seen). A write that
    /// fails leaves them in the file: after a restart they are offered again, and the web view
    /// keeps an id once.
    pub fn confirm(&self, keys: &[Key]) {
        if let Ok(mut file) = self.state.lock() {
            file.items
                .retain(|e| !keys.iter().any(|k| k.peer == e.peer && k.id == e.id));
            let _ = write_json(&self.path, &*file);
        }
    }
}

/// One queued item: `queued`, or `full` after the device said it has no room.
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OutEntry {
    entry: Entry,
    state: String,
}

/// The device's answer to an item, for the web view.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Answer {
    pub peer: String,
    pub id: String,
    /// `delivered` | `full` | `rejected`
    pub state: String,
}

#[derive(Default, Serialize, Deserialize)]
#[serde(default)]
struct OutboxFile {
    v: u8,
    queue: Vec<OutEntry>,
    /// Answers the web view has not confirmed yet (they survive a restart).
    answers: Vec<Answer>,
}

pub struct Outbox {
    path: PathBuf,
    state: Mutex<OutboxFile>,
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
        }
    }

    /// Queues an item for `peer` (lower-case hex key). `Err` when the queue is full or the file
    /// cannot be written. The same (device, id) again is a no-op.
    pub fn push(&self, peer: &str, item: &Item, now_ms: u64) -> Result<(), String> {
        let mut file = self.state.lock().map_err(|_| "internal")?;
        let id = hex(item.id());
        if file
            .queue
            .iter()
            .any(|e| e.entry.peer == peer && e.entry.id == id)
        {
            return Ok(());
        }
        let queued = file.queue.iter().filter(|e| e.entry.peer == peer).count();
        if queued >= OUTBOX_MAX_PER_DEVICE {
            return Err("outbox-full".to_owned());
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
    /// cannot be written), full stays. The answer is kept until the web view confirms it.
    pub fn answer(&self, peer: &str, id: &[u8; 16], state: AckState) {
        let id = hex(id);
        if let Ok(mut file) = self.state.lock() {
            let mine = |e: &OutEntry| e.entry.peer == peer && e.entry.id == id;
            // the same `full` again (a stalled item offered on every ping) changes nothing
            let unchanged = state == AckState::Refused
                && file
                    .queue
                    .iter()
                    .filter(|e| mine(e))
                    .all(|e| e.state == "full")
                && file
                    .answers
                    .iter()
                    .any(|a| a.peer == peer && a.id == id && a.state == "full");
            if unchanged {
                return;
            }
            match state {
                AckState::Refused => {
                    for e in file.queue.iter_mut().filter(|e| mine(e)) {
                        e.state = "full".to_owned();
                    }
                }
                AckState::Stored | AckState::Rejected => file.queue.retain(|e| !mine(e)),
            }
            file.answers.retain(|a| !(a.peer == peer && a.id == id));
            file.answers.push(Answer {
                peer: peer.to_owned(),
                id,
                state: state_name(state).to_owned(),
            });
            let _ = write_json(&self.path, &*file);
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

    /// The answers the web view has not confirmed yet.
    pub fn answers(&self) -> Vec<Answer> {
        self.state
            .lock()
            .map(|f| f.answers.clone())
            .unwrap_or_default()
    }

    /// The web view stored these answers.
    pub fn confirm_answers(&self, keys: &[Key]) {
        if let Ok(mut file) = self.state.lock() {
            file.answers
                .retain(|a| !keys.iter().any(|k| k.peer == a.peer && k.id == a.id));
            let _ = write_json(&self.path, &*file);
        }
    }

    /// E4: the device was paused or switched off at the PC (a lost phone): what waited for it is
    /// dropped and answered `rejected`, so the card says it did not arrive.
    pub fn discard_for(&self, peer: &str) {
        if let Ok(mut file) = self.state.lock() {
            let gone: Vec<String> = file
                .queue
                .iter()
                .filter(|e| e.entry.peer == peer)
                .map(|e| e.entry.id.clone())
                .collect();
            if gone.is_empty() {
                return;
            }
            file.queue.retain(|e| e.entry.peer != peer);
            for id in gone {
                file.answers.retain(|a| !(a.peer == peer && a.id == id));
                file.answers.push(Answer {
                    peer: peer.to_owned(),
                    id,
                    state: "rejected".to_owned(),
                });
            }
            let _ = write_json(&self.path, &*file);
        }
    }

    /// Only these devices keep their queue (a device unpaired, or all after "Schlüssel erneuern").
    pub fn keep_only(&self, peers: &[String]) {
        if let Ok(mut file) = self.state.lock() {
            file.queue.retain(|e| peers.contains(&e.entry.peer));
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

    fn key(peer: &str, n: u8) -> Key {
        Key {
            peer: peer.to_owned(),
            id: hex(&[n; 16]),
        }
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
        // confirming one device's item leaves the other device's item with the same id
        inbox.confirm(&[key("aa", 1)]);
        assert_eq!(inbox.pending().len(), 1);
        assert_eq!(inbox.pending()[0].peer, "bb");
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

    fn take_all(inbox: &Inbox) {
        let keys: Vec<Key> = inbox
            .pending()
            .into_iter()
            .map(|e| Key {
                peer: e.peer,
                id: e.id,
            })
            .collect();
        inbox.confirm(&keys);
    }

    fn numbered(n: usize) -> Item {
        let mut id = [0u8; 16];
        id[..8].copy_from_slice(&(n as u64).to_be_bytes());
        Item::new(id, Kind::Text, "x".into()).unwrap()
    }

    // E1/E2 (launch review 2026-11): one device can fill the other side only so far, and a restart
    // does not reset what it already sent.
    #[test]
    fn one_device_is_held_to_its_hour_and_day_also_after_a_restart() {
        let d = dir("per-device");
        let path = d.join("inbox.json");
        let hour = 3_600_000;
        let mut n = 0;
        let mut send = |inbox: &Inbox, peer: &str, at: u64| {
            n += 1;
            inbox.store(peer, &numbered(n), at)
        };
        let inbox = Inbox::open(&path);
        for _ in 0..PER_DEVICE_HOUR {
            assert_eq!(send(&inbox, "aa", 1_000), Ok(StoreResult::New));
            take_all(&inbox);
        }
        assert_eq!(send(&inbox, "aa", 1_000), Err(InboxError::Full), "hour");
        assert_eq!(
            send(&inbox, "bb", 1_000),
            Ok(StoreResult::New),
            "other devices"
        );
        // a restart keeps the count
        let inbox = Inbox::open(&path);
        assert_eq!(
            send(&inbox, "aa", 2_000),
            Err(InboxError::Full),
            "after a restart"
        );
        // the next hour lets more in, until the day is used up
        let mut at = 1_000 + hour;
        let mut taken = PER_DEVICE_HOUR;
        while taken < PER_DEVICE_DAY {
            match send(&inbox, "aa", at) {
                Ok(_) => {
                    taken += 1;
                    take_all(&inbox);
                }
                Err(_) => at += hour,
            }
        }
        assert_eq!(send(&inbox, "aa", at + hour), Err(InboxError::Full), "day");
        assert_eq!(
            send(&inbox, "aa", 1_000 + 25 * hour),
            Ok(StoreResult::New),
            "a new day"
        );
    }

    // E4 (launch review 2026-11): pausing a device drops what waited for it.
    #[test]
    fn a_paused_device_loses_its_queue_and_the_cards_say_so() {
        let d = dir("discard");
        let path = d.join("outbox.json");
        let outbox = Outbox::open(&path);
        outbox.push("aa", &item(1, "für das Handy"), 1).unwrap();
        outbox.push("aa", &item(2, "noch eins"), 2).unwrap();
        outbox.push("bb", &item(3, "anderes Gerät"), 3).unwrap();
        outbox.discard_for("aa");
        assert!(
            outbox.next_for("aa").is_none(),
            "nothing goes to it any more"
        );
        assert!(outbox.next_for("bb").is_some(), "other devices keep theirs");
        let rejected: Vec<_> = outbox
            .answers()
            .into_iter()
            .filter(|a| a.peer == "aa" && a.state == "rejected")
            .collect();
        assert_eq!(rejected.len(), 2);
        // also after a restart
        let again = Outbox::open(&path);
        assert!(again.next_for("aa").is_none());
        assert_eq!(again.answers().len(), 2);
    }

    #[test]
    fn a_full_inbox_takes_nothing_more() {
        let d = dir("full");
        let inbox = Inbox::open(&d.join("inbox.json"));
        // from several devices, so no device reaches its own limit first
        for n in 0..INBOX_MAX {
            let peer = format!("{:02x}", n % 4);
            assert_eq!(inbox.store(&peer, &numbered(n), 1), Ok(StoreResult::New));
        }
        assert_eq!(
            inbox.store("aa", &item(0xff, "x"), 1),
            Err(InboxError::Full)
        );
    }

    #[test]
    fn a_broken_file_is_moved_aside_not_overwritten() {
        let d = dir("broken");
        let path = d.join("inbox.json");
        std::fs::write(&path, b"{ not json").unwrap();
        let inbox = Inbox::open(&path);
        assert!(inbox.pending().is_empty());
        assert_eq!(
            std::fs::read(d.join("inbox.json.broken")).unwrap(),
            b"{ not json"
        );
        inbox.store("aa", &item(1, "x"), 1).unwrap();
        assert_eq!(Inbox::open(&path).pending().len(), 1);
    }

    #[test]
    fn the_outbox_survives_a_restart_and_keeps_answers_until_confirmed() {
        let d = dir("outbox");
        let path = d.join("outbox.json");
        let out = Outbox::open(&path);
        out.push("aa", &item(1, "eins"), 1).unwrap();
        out.push("aa", &item(2, "zwei"), 2).unwrap();
        // the same id to another device is its own entry
        out.push("bb", &item(1, "eins"), 3).unwrap();
        assert_eq!(out.queued().len(), 3);
        let out = Outbox::open(&path);
        assert_eq!(out.next_for("aa").unwrap().id(), &[1; 16]);
        out.answer("aa", &[1; 16], AckState::Stored);
        assert_eq!(
            out.next_for("bb").unwrap().id(),
            &[1; 16],
            "b's own entry stays"
        );
        assert_eq!(out.next_for("aa").unwrap().id(), &[2; 16]);
        out.answer("aa", &[2; 16], AckState::Refused);
        assert_eq!(out.next_for("aa").unwrap().id(), &[2; 16], "full stays");
        out.answer("aa", &[2; 16], AckState::Rejected);
        assert!(out.next_for("aa").is_none());
        // answers survive a restart until the web view confirms them (latest per item)
        let out = Outbox::open(&path);
        let answers = out.answers();
        assert_eq!(
            answers.iter().map(|a| a.state.as_str()).collect::<Vec<_>>(),
            ["delivered", "rejected"]
        );
        out.confirm_answers(&[key("aa", 1), key("aa", 2)]);
        assert!(out.answers().is_empty());
        out.keep_only(&[]);
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
