//! The boundary between an exchange session and the files on disk (package 2b). The session
//! carries the records (`wire`) and keeps their order (`transfer`); **what** is written, kept,
//! hashed or read is the shell's: it implements [`ExchangeFiles`] (part files, resume, SHA-256,
//! the receiver's limits and daily count, the origin mark, the outgoing queue). Nothing here
//! touches the file system; [`MemoryFiles`] serves tests and tools.
//!
//! Receiving (device → PC): `offered` decides at once (accept from an offset, wait for the user,
//! refuse); a waiting offer is decided later through `decided`. Chunks come in order and go to
//! `write`; `finish` checks length and hash and answers the `result`. A transfer or a waiting
//! offer that ends early goes to `stopped` with the reason.
//!
//! Sending (PC → device): `next_offer` hands out the oldest queued file the session is not done
//! with; `read` gives its bytes from an offset; `queued` says whether an offer still stands;
//! `sent` reports how it ended.
//!
//! **How often and how long.** The session asks `decided`, `next_offer` and `queued` at most every
//! 50 ms (answer them from memory); `write` and `read` once per chunk (64 KB). Every call runs on
//! the connection's thread: nothing else of that connection is read or written meanwhile, so
//! calls must be short. Hash while writing and while reading (never the whole file at `finish`);
//! the one long call allowed is `offered` re-hashing a kept part before a resume.
//!
//! **Two sessions.** When a device opens a new exchange session, the old one is closed, but its
//! thread may still be inside a call or deliver a late `stopped`/`sent` after the new session's
//! `offered`/`next_offer` for the same file. The store serializes the calls for one (device, id)
//! and lets the newest transfer win (a late `stopped(Lost)` must not undo a `finish`).

use super::wire::{Offer, RefuseCode, ResultCode, WaitReason};
use crate::noise::PublicKey;
#[cfg(test)]
use std::collections::{HashMap, VecDeque};
#[cfg(test)]
use std::sync::Mutex;

/// The receiver's answer to an offer.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Decision {
    /// Take it, from this offset (`> 0`: the part of an earlier session is resumed).
    Accept {
        from: u64,
    },
    /// The user decides first (_Annehmen_); answered later through [`ExchangeFiles::decided`].
    Wait(WaitReason),
    Refuse(RefuseCode),
}

/// Why an incoming transfer or a waiting offer ended before `finish`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Stopped {
    /// The session ended (connection lost, replaced, closed): keep the part for a resume
    /// („Pausiert“).
    Lost,
    /// The sending device's user cancelled it: the part may go („Abgebrochen“).
    Cancelled,
    /// An offer that waited for this side's user is gone (cancelled, or the session ended): drop
    /// its _Annehmen_ prompt. A later decision for it is not asked for any more; the device offers
    /// it again on a new session, and `offered` decides again.
    Withdrawn,
}

/// How an outgoing file ended, from the PC's side.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SendOutcome {
    /// The device waits for its user; the file stays queued and the offer stands.
    Waiting(WaitReason),
    /// The device refused it.
    Refused(RefuseCode),
    /// Every byte went out and the device answered.
    Done(ResultCode),
    /// The device's user cancelled it: it leaves the queue.
    Cancelled,
    /// The file could not be read (changed, gone, withdrawn at the PC) or the session ended
    /// first: it stays queued (unless the PC took it out) and is offered again on the next
    /// session, where the device resumes its part.
    Interrupted,
}

/// What the session asks of the files on this PC (see the module's header for timing).
pub trait ExchangeFiles: Send + Sync {
    /// A device offers a file (already checked by the wire; its name is raw and untrusted).
    fn offered(&self, from: &PublicKey, offer: &Offer) -> Decision;
    /// The user's later answer to a waiting offer of this device, once (`Wait` is not an answer).
    fn decided(&self, from: &PublicKey, id: &[u8; 16]) -> Option<Decision>;
    /// Bytes of an accepted transfer, in order (`offset` is where the part ends). An error is the
    /// `result` the device gets (`Full` or `Failed`); the transfer is over then.
    fn write(
        &self,
        from: &PublicKey,
        id: &[u8; 16],
        offset: u64,
        bytes: &[u8],
    ) -> Result<(), ResultCode>;
    /// The sender says every byte is out (the session checked the length): check the hash, put the
    /// file in place.
    fn finish(&self, from: &PublicKey, id: &[u8; 16]) -> ResultCode;
    /// An incoming transfer or a waiting offer ended before `finish`.
    fn stopped(&self, from: &PublicKey, id: &[u8; 16], how: Stopped);

    /// The oldest file queued for this device that is not in `skip` (what this session has
    /// offered, finished or given up), if any.
    fn next_offer(&self, to: &PublicKey, skip: &[[u8; 16]]) -> Option<Offer>;
    /// Whether this file is still queued (an offer the PC took back is cancelled at the device).
    fn queued(&self, to: &PublicKey, id: &[u8; 16]) -> bool;
    /// Bytes of a queued file from `offset` into `buf`; `Ok(0)` only at its end. An error (the
    /// file changed, its hash no longer matches the offer, it is gone) cancels the transfer – also
    /// on the last read: `end` follows the last byte without asking again.
    fn read(&self, to: &PublicKey, id: &[u8; 16], offset: u64, buf: &mut [u8])
        -> Result<usize, ()>;
    /// How an outgoing file ended (or that it waits for the device's user). An offer that gave
    /// up the active slot for a file the device accepted meanwhile is reported `Waiting` only once
    /// the device says so; until then it simply stands.
    fn sent(&self, to: &PublicKey, id: &[u8; 16], outcome: SendOutcome);
}

/// One received file in memory.
#[cfg(test)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Received {
    pub from: [u8; 32],
    pub id: [u8; 16],
    pub bytes: Vec<u8>,
    /// `None` while it is written; then the code `finish` answered.
    pub result: Option<ResultCode>,
}

#[cfg(test)]
type Key = ([u8; 32], [u8; 16]);

/// Files for tests (compiled in tests only): decides every offer the same way, keeps received bytes in memory and checks
/// only the length at `finish` (hashing is the shell's).
#[cfg(test)]
pub struct MemoryFiles {
    decision: Mutex<Decision>,
    later: Mutex<HashMap<[u8; 16], Decision>>,
    sizes: Mutex<HashMap<Key, u64>>,
    received: Mutex<Vec<Received>>,
    outgoing: Mutex<HashMap<[u8; 32], VecDeque<(Offer, Vec<u8>)>>>,
    outcomes: Mutex<Vec<([u8; 16], SendOutcome)>>,
    stops: Mutex<Vec<([u8; 16], Stopped)>>,
    /// Every write answers `Full` (a disk that filled up).
    pub fail_writes: std::sync::atomic::AtomicBool,
}

#[cfg(test)]
impl Default for MemoryFiles {
    fn default() -> Self {
        MemoryFiles {
            decision: Mutex::new(Decision::Accept { from: 0 }),
            later: Mutex::default(),
            sizes: Mutex::default(),
            received: Mutex::default(),
            outgoing: Mutex::default(),
            outcomes: Mutex::default(),
            stops: Mutex::default(),
            fail_writes: std::sync::atomic::AtomicBool::new(false),
        }
    }
}

#[cfg(test)]
impl MemoryFiles {
    pub fn new() -> Self {
        Self::default()
    }

    /// The answer to every offer from now on.
    pub fn set_decision(&self, d: Decision) {
        if let Ok(mut x) = self.decision.lock() {
            *x = d;
        }
    }

    /// The user's later answer to a waiting offer.
    pub fn decide_later(&self, id: [u8; 16], d: Decision) {
        if let Ok(mut x) = self.later.lock() {
            x.insert(id, d);
        }
    }

    /// Queues a file for a device (`offer.size()` must be `bytes.len()`).
    pub fn queue(&self, to: &PublicKey, offer: Offer, bytes: Vec<u8>) {
        if let Ok(mut q) = self.outgoing.lock() {
            q.entry(*to.as_bytes())
                .or_default()
                .push_back((offer, bytes));
        }
    }

    /// Takes a file out of the queue (the PC's user withdrew it).
    pub fn withdraw(&self, to: &PublicKey, id: &[u8; 16]) {
        if let Ok(mut q) = self.outgoing.lock() {
            if let Some(queue) = q.get_mut(to.as_bytes()) {
                queue.retain(|(o, _)| o.id() != id);
            }
        }
    }

    /// What `next_offer` would hand out for this device.
    pub fn next_offer_for(&self, to: &PublicKey) -> Option<Offer> {
        self.next_offer(to, &[])
    }

    pub fn received(&self) -> Vec<Received> {
        self.received.lock().map(|r| r.clone()).unwrap_or_default()
    }

    pub fn outcomes(&self) -> Vec<([u8; 16], SendOutcome)> {
        self.outcomes.lock().map(|o| o.clone()).unwrap_or_default()
    }

    pub fn stops(&self) -> Vec<([u8; 16], Stopped)> {
        self.stops.lock().map(|i| i.clone()).unwrap_or_default()
    }

    /// Starts (or finds) the received file, with `from` bytes already there (a resumed part).
    fn start(&self, from: &PublicKey, id: &[u8; 16], at: u64) {
        let Ok(mut r) = self.received.lock() else {
            return;
        };
        if !r.iter().any(|x| x.from == *from.as_bytes() && x.id == *id) {
            r.push(Received {
                from: *from.as_bytes(),
                id: *id,
                bytes: vec![0; usize::try_from(at).unwrap_or(0)],
                result: None,
            });
        }
    }

    fn entry<T>(
        &self,
        from: &PublicKey,
        id: &[u8; 16],
        f: impl FnOnce(&mut Received) -> T,
    ) -> Option<T> {
        let mut r = self.received.lock().ok()?;
        r.iter_mut()
            .find(|x| x.from == *from.as_bytes() && x.id == *id)
            .map(f)
    }
}

#[cfg(test)]
impl ExchangeFiles for MemoryFiles {
    fn offered(&self, from: &PublicKey, offer: &Offer) -> Decision {
        if let Ok(mut s) = self.sizes.lock() {
            s.insert((*from.as_bytes(), *offer.id()), offer.size());
        }
        let d = self
            .decision
            .lock()
            .map_or(Decision::Refuse(RefuseCode::Full), |d| *d);
        if let Decision::Accept { from: at } = d {
            self.start(from, offer.id(), at);
        }
        d
    }

    fn decided(&self, from: &PublicKey, id: &[u8; 16]) -> Option<Decision> {
        let d = self.later.lock().ok()?.remove(id)?;
        if let Decision::Accept { from: at } = d {
            self.start(from, id, at);
        }
        Some(d)
    }

    fn write(
        &self,
        from: &PublicKey,
        id: &[u8; 16],
        offset: u64,
        bytes: &[u8],
    ) -> Result<(), ResultCode> {
        if self.fail_writes.load(std::sync::atomic::Ordering::SeqCst) {
            return Err(ResultCode::Full);
        }
        self.entry(from, id, |r| {
            if u64::try_from(r.bytes.len()).ok() != Some(offset) {
                return Err(ResultCode::Failed);
            }
            r.bytes.extend_from_slice(bytes);
            Ok(())
        })
        .unwrap_or(Err(ResultCode::Failed))
    }

    fn finish(&self, from: &PublicKey, id: &[u8; 16]) -> ResultCode {
        let size = self
            .sizes
            .lock()
            .ok()
            .and_then(|s| s.get(&(*from.as_bytes(), *id)).copied());
        self.entry(from, id, |r| {
            let code = if size == u64::try_from(r.bytes.len()).ok() {
                ResultCode::Ok
            } else {
                ResultCode::Mismatch
            };
            r.result = Some(code);
            code
        })
        .unwrap_or(ResultCode::Failed)
    }

    fn stopped(&self, _from: &PublicKey, id: &[u8; 16], how: Stopped) {
        if let Ok(mut i) = self.stops.lock() {
            i.push((*id, how));
        }
    }

    fn next_offer(&self, to: &PublicKey, skip: &[[u8; 16]]) -> Option<Offer> {
        let q = self.outgoing.lock().ok()?;
        q.get(to.as_bytes())?
            .iter()
            .find(|(o, _)| !skip.contains(o.id()))
            .map(|(o, _)| o.clone())
    }

    fn queued(&self, to: &PublicKey, id: &[u8; 16]) -> bool {
        self.outgoing.lock().is_ok_and(|q| {
            q.get(to.as_bytes())
                .is_some_and(|q| q.iter().any(|(o, _)| o.id() == id))
        })
    }

    fn read(
        &self,
        to: &PublicKey,
        id: &[u8; 16],
        offset: u64,
        buf: &mut [u8],
    ) -> Result<usize, ()> {
        let q = self.outgoing.lock().map_err(|_| ())?;
        let (_, bytes) = q
            .get(to.as_bytes())
            .and_then(|q| q.iter().find(|(o, _)| o.id() == id))
            .ok_or(())?;
        let start = usize::try_from(offset).map_err(|_| ())?;
        let rest = bytes.get(start..).ok_or(())?;
        let n = rest.len().min(buf.len());
        buf[..n].copy_from_slice(&rest[..n]);
        Ok(n)
    }

    fn sent(&self, to: &PublicKey, id: &[u8; 16], outcome: SendOutcome) {
        if let Ok(mut o) = self.outcomes.lock() {
            o.push((*id, outcome));
        }
        // refused, done and cancelled leave the queue; waiting and interrupted stay
        if matches!(
            outcome,
            SendOutcome::Refused(_) | SendOutcome::Done(_) | SendOutcome::Cancelled
        ) {
            self.withdraw(to, id);
        }
    }
}
