//! The PC's side of device exchange that is not the session: the switch ("exchange is on at this
//! PC"), the per-device grant in the trust list, the per-device rate limit, and the boundaries to
//! the shell (inbox, outbox). The writers (`set_enabled`, `set_device`) are called only from the
//! PC's own controls; the shell confirms every widening in a native dialog before it calls them.
//! No frame from the network reaches a writer (`tests/rules.rs`).

use super::wire::{Code, Item};
use crate::input::{MasterSwitch, MemorySwitch};
use crate::noise::PublicKey;
use crate::trust::{ExchangeGrant, TrustError, TrustStore};
use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// Items one device may send in one window.
pub const ITEMS_PER_WINDOW: u32 = 300;
pub const RATE_WINDOW: Duration = Duration::from_secs(60 * 60);
/// Devices tracked by the rate limit at once (only granted devices ever get here).
const MAX_TRACKED: usize = 256;

/// The receiving side's inbox cannot take the item right now. Carries no bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct InboxFull;

/// Where an item from a device is kept **before** it is acked (the shell writes it to a file, the
/// web view takes it over later). An `Ok` means: it survives a restart.
pub trait ExchangeInbox: Send + Sync {
    fn store(&self, from: &PublicKey, item: &Item) -> Result<(), InboxFull>;
}

/// What the PC queued for a device. `next` hands out the oldest item without removing it;
/// `delivered` removes it after the device's `ack`.
pub trait ExchangeOutbox: Send + Sync {
    fn next(&self, to: &PublicKey) -> Option<Item>;
    fn delivered(&self, to: &PublicKey, id: &[u8; 16]);
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
    fn store(&self, from: &PublicKey, item: &Item) -> Result<(), InboxFull> {
        if self.full.load(std::sync::atomic::Ordering::SeqCst) {
            return Err(InboxFull);
        }
        let mut items = self.items.lock().map_err(|_| InboxFull)?;
        items.push((*from.as_bytes(), item.clone()));
        Ok(())
    }
}

/// Outbox for tests and tools.
#[derive(Default)]
pub struct MemoryOutbox {
    queues: Mutex<HashMap<[u8; 32], VecDeque<Item>>>,
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
}

impl ExchangeOutbox for MemoryOutbox {
    fn next(&self, to: &PublicKey) -> Option<Item> {
        self.queues.lock().ok()?.get(to.as_bytes())?.front().cloned()
    }
    fn delivered(&self, to: &PublicKey, id: &[u8; 16]) {
        if let Ok(mut q) = self.queues.lock() {
            if let Some(queue) = q.get_mut(to.as_bytes()) {
                queue.retain(|i| &i.id != id);
            }
        }
    }
}

struct Window {
    started: Duration,
    count: u32,
}

/// Device exchange at this PC.
pub struct Exchange {
    switch: Arc<dyn MasterSwitch>,
    trust: Arc<dyn TrustStore>,
    inbox: Arc<dyn ExchangeInbox>,
    outbox: Arc<dyn ExchangeOutbox>,
    rate: Mutex<HashMap<[u8; 32], Window>>,
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

    /// Counts one item of `peer`; `false` once the device sent [`ITEMS_PER_WINDOW`] in the window.
    /// `now` is monotonic time from the caller (nothing here reads a clock). Kept in memory only.
    pub(crate) fn count(&self, peer: &PublicKey, now: Duration) -> bool {
        let Ok(mut rate) = self.rate.lock() else {
            return false;
        };
        if rate.len() >= MAX_TRACKED && !rate.contains_key(peer.as_bytes()) {
            rate.retain(|_, w| now.saturating_sub(w.started) < RATE_WINDOW);
            if rate.len() >= MAX_TRACKED {
                return false;
            }
        }
        let w = rate.entry(*peer.as_bytes()).or_insert(Window {
            started: now,
            count: 0,
        });
        if now.saturating_sub(w.started) >= RATE_WINDOW {
            *w = Window {
                started: now,
                count: 0,
            };
        }
        if w.count >= ITEMS_PER_WINDOW {
            return false;
        }
        w.count += 1;
        true
    }

    pub(crate) fn inbox(&self) -> &dyn ExchangeInbox {
        &*self.inbox
    }

    pub(crate) fn outbox(&self) -> &dyn ExchangeOutbox {
        &*self.outbox
    }
}
