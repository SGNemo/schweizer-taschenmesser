//! The PC's side of device exchange that is not the session: the switch ("exchange is on at this
//! PC"), the per-device grant in the trust list, the per-device rate limit, and the boundaries to
//! the shell (inbox, outbox). The writers (`set_enabled`, `set_device`) are called only from the
//! PC's own controls; the shell confirms every widening in a native dialog before it calls them.
//! No frame from the network reaches a writer (`tests/rules.rs`).

use super::wire::{AckState, Code, Item};
use crate::input::{MasterSwitch, MemorySwitch};
use crate::noise::PublicKey;
use crate::trust::{ExchangeGrant, TrustError, TrustStore};
use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// Items one device may have stored in any [`RATE_WINDOW`] (a sliding window).
pub const ITEMS_PER_WINDOW: usize = 300;
pub const RATE_WINDOW: Duration = Duration::from_secs(60 * 60);
/// Devices tracked by the rate limit at once (only granted devices ever get here).
const MAX_TRACKED: usize = 256;

/// The receiving side's inbox cannot take the item right now. Carries no bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct InboxFull;

/// Where an item from a device is kept **before** it is acked (the shell writes it to a file, the
/// web view takes it over later). An `Ok` means: it survives a restart.
///
/// Delivery is at least once: a lost ack (a replaced session, an idle close, the home network
/// gone) makes the device send the item again – also after the web view has taken the first copy
/// over. `store` of an id it has seen from that device (kept at least for [`RATE_WINDOW`], across
/// the hand-over) is therefore `Ok` and stores nothing new.
pub trait ExchangeInbox: Send + Sync {
    fn store(&self, from: &PublicKey, item: &Item) -> Result<Stored, InboxFull>;
}

/// What `store` did: kept a new item, or knew the id already (only new ones count against the
/// rate limit).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Stored {
    New,
    Known,
}

/// What the PC queued for a device. `next` hands out the oldest item without removing it and is
/// asked on every tick of a live session: it must answer from memory (write files only on change),
/// and `answered` must drop the item from memory even when writing that down fails.
/// `answered` reports the device's answer to an item it sent: `Stored` and `Rejected` take it out
/// of the queue (the shell shows „Kam nicht an“ for `Rejected`), `Refused` keeps it (the device
/// is full; the shell shows that, and it is offered again on the device's next ping).
pub trait ExchangeOutbox: Send + Sync {
    fn next(&self, to: &PublicKey) -> Option<Item>;
    fn answered(&self, to: &PublicKey, id: &[u8; 16], state: AckState);
}

/// Inbox for tests and tools.
#[derive(Default)]
pub struct MemoryInbox {
    items: Mutex<Vec<([u8; 32], Item)>>,
    /// Refuse everything (a full inbox).
    pub full: std::sync::atomic::AtomicBool,
}

impl MemoryInbox {
    pub fn new() -> Self {
        Self::default()
    }
    /// What came in, in order.
    pub fn items(&self) -> Vec<([u8; 32], Item)> {
        self.items.lock().map(|i| i.clone()).unwrap_or_default()
    }
}

impl ExchangeInbox for MemoryInbox {
    fn store(&self, from: &PublicKey, item: &Item) -> Result<Stored, InboxFull> {
        if self.full.load(std::sync::atomic::Ordering::SeqCst) {
            return Err(InboxFull);
        }
        let mut items = self.items.lock().map_err(|_| InboxFull)?;
        let known = items
            .iter()
            .any(|(k, i)| k == from.as_bytes() && i.id() == item.id());
        if known {
            return Ok(Stored::Known);
        }
        items.push((*from.as_bytes(), item.clone()));
        Ok(Stored::New)
    }
}

/// Outbox for tests and tools.
#[derive(Default)]
pub struct MemoryOutbox {
    queues: Mutex<HashMap<[u8; 32], VecDeque<Item>>>,
    answers: Mutex<Vec<([u8; 16], AckState)>>,
}

impl MemoryOutbox {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn push(&self, to: &PublicKey, item: Item) {
        if let Ok(mut q) = self.queues.lock() {
            q.entry(*to.as_bytes()).or_default().push_back(item);
        }
    }
    pub fn len(&self, to: &PublicKey) -> usize {
        self.queues
            .lock()
            .map(|q| q.get(to.as_bytes()).map_or(0, VecDeque::len))
            .unwrap_or(0)
    }
    /// Every answer, in order.
    pub fn answers(&self) -> Vec<([u8; 16], AckState)> {
        self.answers.lock().map(|a| a.clone()).unwrap_or_default()
    }
}

impl ExchangeOutbox for MemoryOutbox {
    fn next(&self, to: &PublicKey) -> Option<Item> {
        self.queues
            .lock()
            .ok()?
            .get(to.as_bytes())?
            .front()
            .cloned()
    }
    fn answered(&self, to: &PublicKey, id: &[u8; 16], state: AckState) {
        if let Ok(mut a) = self.answers.lock() {
            a.push((*id, state));
        }
        if state == AckState::Refused {
            return;
        }
        if let Ok(mut q) = self.queues.lock() {
            if let Some(queue) = q.get_mut(to.as_bytes()) {
                queue.retain(|i| i.id() != id);
            }
        }
    }
}

/// Device exchange at this PC.
pub struct Exchange {
    switch: Arc<dyn MasterSwitch>,
    trust: Arc<dyn TrustStore>,
    inbox: Arc<dyn ExchangeInbox>,
    outbox: Arc<dyn ExchangeOutbox>,
    /// When each stored item of a device came in (the last [`RATE_WINDOW`] only). Memory only.
    rate: Mutex<HashMap<[u8; 32], VecDeque<Duration>>>,
    /// Live exchange sessions per device (opened and not yet dropped).
    live: Mutex<HashMap<[u8; 32], u32>>,
}

impl Exchange {
    pub fn new(
        switch: Arc<dyn MasterSwitch>,
        trust: Arc<dyn TrustStore>,
        inbox: Arc<dyn ExchangeInbox>,
        outbox: Arc<dyn ExchangeOutbox>,
    ) -> Self {
        Exchange {
            switch,
            trust,
            inbox,
            outbox,
            rate: Mutex::new(HashMap::new()),
            live: Mutex::new(HashMap::new()),
        }
    }

    /// Off switch, memory inbox and outbox (tests).
    pub fn in_memory(trust: Arc<dyn TrustStore>) -> Self {
        Self::new(
            Arc::new(MemorySwitch::new()),
            trust,
            Arc::new(MemoryInbox::new()),
            Arc::new(MemoryOutbox::new()),
        )
    }

    /// Whether exchange is on at this PC (the module is switched on here).
    pub fn enabled(&self) -> bool {
        self.switch.enabled()
    }

    /// The PC's switch. Switching it on while a grant is stored widens: the shell confirms first.
    pub fn set_enabled(&self, on: bool) -> Result<(), TrustError> {
        self.switch.set(on).map_err(|_| TrustError::Storage)
    }

    pub fn grant_of(&self, peer: &PublicKey) -> ExchangeGrant {
        self.trust.exchange_of(peer)
    }

    /// The device's grant. A widening (`ExchangeGrant::widens`) is confirmed by the shell first.
    /// Taking it away or pausing closes the device's exchange session on its next tick.
    pub fn set_device(&self, peer: &PublicKey, grant: ExchangeGrant) -> Result<(), TrustError> {
        self.trust.set_exchange(peer, grant)
    }

    /// Whether the device may exchange right now, and if not, why (the order the phone shows).
    pub(crate) fn admit(&self, peer: &PublicKey) -> Result<(), Code> {
        if !self.enabled() {
            return Err(Code::ExchangeOff);
        }
        let grant = self.grant_of(peer);
        if !grant.on {
            Err(Code::NotGranted)
        } else if grant.paused {
            Err(Code::Paused)
        } else {
            Ok(())
        }
    }

    /// While the device has [`ITEMS_PER_WINDOW`] stored items in the last [`RATE_WINDOW`]: the
    /// whole minutes until the oldest of them leaves the window (1..=60). `now` is monotonic time
    /// from the caller (nothing here reads a clock).
    pub(crate) fn limited(&self, peer: &PublicKey, now: Duration) -> Option<u8> {
        let Ok(mut rate) = self.rate.lock() else {
            return Some(60);
        };
        // a device the full table cannot track is not taken (fail-closed, before anything is stored)
        if rate.len() >= MAX_TRACKED && !rate.contains_key(peer.as_bytes()) {
            rate.retain(|_, t| {
                t.back()
                    .is_some_and(|b| now.saturating_sub(*b) < RATE_WINDOW)
            });
            if rate.len() >= MAX_TRACKED {
                return Some(60);
            }
        }
        let times = rate.get_mut(peer.as_bytes())?;
        while times
            .front()
            .is_some_and(|t| now.saturating_sub(*t) >= RATE_WINDOW)
        {
            times.pop_front();
        }
        if times.len() < ITEMS_PER_WINDOW {
            return None;
        }
        let oldest = *times.front()?;
        let left = RATE_WINDOW.saturating_sub(now.saturating_sub(oldest));
        let minutes = left.as_secs().div_ceil(60).clamp(1, 60);
        Some(u8::try_from(minutes).unwrap_or(60))
    }

    /// Records one stored item of `peer` (refused and rejected items do not count). `limited` was
    /// asked first, so the device has a place in the table.
    /// The table never grows past its cap here either (two new devices may pass `limited` at once).
    pub(crate) fn record(&self, peer: &PublicKey, now: Duration) {
        if let Ok(mut rate) = self.rate.lock() {
            if let Some(times) = rate.get_mut(peer.as_bytes()) {
                times.push_back(now);
            } else if rate.len() < MAX_TRACKED {
                rate.insert(*peer.as_bytes(), VecDeque::from([now]));
            }
        }
    }

    /// Whether the device has a live exchange session (it opened one that was accepted and has
    /// not ended). For the PC's „erreichbar“ and „wird übergeben“.
    pub fn connected(&self, peer: &PublicKey) -> bool {
        self.live
            .lock()
            .is_ok_and(|l| l.get(peer.as_bytes()).is_some_and(|n| *n > 0))
    }

    pub(crate) fn session_opened(&self, peer: &PublicKey) {
        if let Ok(mut l) = self.live.lock() {
            *l.entry(*peer.as_bytes()).or_default() += 1;
        }
    }

    pub(crate) fn session_ended(&self, peer: &PublicKey) {
        if let Ok(mut l) = self.live.lock() {
            if let Some(n) = l.get_mut(peer.as_bytes()) {
                *n = n.saturating_sub(1);
                if *n == 0 {
                    l.remove(peer.as_bytes());
                }
            }
        }
    }

    pub(crate) fn inbox(&self) -> &dyn ExchangeInbox {
        &*self.inbox
    }

    pub(crate) fn outbox(&self) -> &dyn ExchangeOutbox {
        &*self.outbox
    }
}
