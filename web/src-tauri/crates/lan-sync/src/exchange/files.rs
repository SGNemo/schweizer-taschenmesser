//! The boundary between an exchange session and the files on disk (package 2b). The session
//! carries the records (`wire`) and keeps their order; **what** is written, kept, hashed or read
//! is the shell's: it implements [`ExchangeFiles`] (part files, resume, SHA-256, the receiver's
//! limits and daily count, the origin mark, the outgoing queue). Nothing here touches the file
//! system; [`MemoryFiles`] serves tests and tools.
//!
//! Receiving (device → PC): `offered` decides at once (accept from an offset, wait for the user,
//! refuse); a waiting offer is decided later through `decided`. Chunks come in order and go to
//! `write`; `finish` checks length and hash and answers the `result`. A transfer that ends early
//! (the session closed, the sender cancelled) goes to `interrupted`: the part stays for a resume.
//!
//! Sending (PC → device): `next_offer` hands out the oldest queued file (from memory, asked on
//! every tick); `read` gives its bytes from an offset; `sent` reports how it ended.

use super::wire::{Offer, RefuseCode, ResultCode, WaitReason};
use crate::noise::PublicKey;
use std::collections::{HashMap, VecDeque};
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
    /// The file could not be read (changed, gone, cancelled at the PC) or the session ended
    /// first: it stays queued (unless the PC took it out) and is offered again on the next
    /// session, where the device resumes its part.
    Interrupted,
}

/// What the session asks of the files on this PC. All calls are short (one chunk at most).
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
    /// The sender says every byte is out: check length and hash, put the file in place.
    fn finish(&self, from: &PublicKey, id: &[u8; 16]) -> ResultCode;
    /// The transfer ended before `finish` (cancelled, session over): keep the part for a resume.
    fn interrupted(&self, from: &PublicKey, id: &[u8; 16]);

    /// The oldest file queued for this device that is not in `skip` (what this session is done
    /// with), if any. From memory: asked on every tick.
    fn next_offer(&self, to: &PublicKey, skip: &[[u8; 16]]) -> Option<Offer>;
    /// Bytes of a queued file from `offset` into `buf`; `Ok(0)` only at its end. An error (the
    /// file changed or is gone) cancels the transfer.
    fn read(&self, to: &PublicKey, id: &[u8; 16], offset: u64, buf: &mut [u8])
        -> Result<usize, ()>;
    /// How an outgoing file ended.
    fn sent(&self, to: &PublicKey, id: &[u8; 16], outcome: SendOutcome);
}

/// One received file in memory.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Received {
    pub from: [u8; 32],
    pub id: [u8; 16],
    pub bytes: Vec<u8>,
    /// `None` while it is written; then the code `finish` answered.
    pub result: Option<ResultCode>,
}

/// Files for tests and tools: decides every offer the same way, keeps received bytes in memory and
/// checks only the length at `finish` (hashing is the shell's).
pub struct MemoryFiles {
    /// The answer to every offer.
    pub decision: Mutex<Decision>,
    /// Later answers to waiting offers, by id.
    pub later: Mutex<HashMap<[u8; 16], Decision>>,
    sizes: Mutex<HashMap<[u8; 16], u64>>,
    received: Mutex<Vec<Received>>,
    outgoing: Mutex<HashMap<[u8; 32], VecDeque<(Offer, Vec<u8>)>>>,
    outcomes: Mutex<Vec<([u8; 16], SendOutcome)>>,
    interruptions: Mutex<Vec<[u8; 16]>>,
}

impl Default for MemoryFiles {
    fn default() -> Self {
        MemoryFiles {
            decision: Mutex::new(Decision::Accept { from: 0 }),
            later: Mutex::default(),
            sizes: Mutex::default(),
            received: Mutex::default(),
            outgoing: Mutex::default(),
            outcomes: Mutex::default(),
            interruptions: Mutex::default(),
        }
    }
}

impl MemoryFiles {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_decision(&self, d: Decision) {
        if let Ok(mut x) = self.decision.lock() {
            *x = d;
        }
    }

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

    /// What `next_offer` would hand out for this device (tests).
    pub fn next_offer_for(&self, to: &PublicKey) -> Option<Offer> {
        self.next_offer(to, &[])
    }

    pub fn received(&self) -> Vec<Received> {
        self.received.lock().map(|r| r.clone()).unwrap_or_default()
    }

    pub fn outcomes(&self) -> Vec<([u8; 16], SendOutcome)> {
        self.outcomes.lock().map(|o| o.clone()).unwrap_or_default()
    }

    pub fn interruptions(&self) -> Vec<[u8; 16]> {
        self.interruptions
            .lock()
            .map(|i| i.clone())
            .unwrap_or_default()
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

impl ExchangeFiles for MemoryFiles {
    fn offered(&self, from: &PublicKey, offer: &Offer) -> Decision {
        let d = self
            .decision
            .lock()
            .map_or(Decision::Refuse(RefuseCode::Full), |d| *d);
        if let Decision::Accept { from: at } = d {
            if let Ok(mut s) = self.sizes.lock() {
                s.insert(*offer.id(), offer.size());
            }
            let known = self.entry(from, offer.id(), |_| ()).is_some();
            if !known {
                if let Ok(mut r) = self.received.lock() {
                    r.push(Received {
                        from: *from.as_bytes(),
                        id: *offer.id(),
                        bytes: vec![0; usize::try_from(at).unwrap_or(0)],
                        result: None,
                    });
                }
            }
        } else if let Ok(mut s) = self.sizes.lock() {
            s.insert(*offer.id(), offer.size());
        }
        d
    }

    fn decided(&self, from: &PublicKey, id: &[u8; 16]) -> Option<Decision> {
        let d = self.later.lock().ok()?.remove(id)?;
        if let Decision::Accept { .. } = d {
            if let Ok(mut r) = self.received.lock() {
                r.push(Received {
                    from: *from.as_bytes(),
                    id: *id,
                    bytes: Vec::new(),
                    result: None,
                });
            }
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
        let size = self.sizes.lock().ok().and_then(|s| s.get(id).copied());
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

    fn interrupted(&self, _from: &PublicKey, id: &[u8; 16]) {
        if let Ok(mut i) = self.interruptions.lock() {
            i.push(*id);
        }
    }

    fn next_offer(&self, to: &PublicKey, skip: &[[u8; 16]]) -> Option<Offer> {
        let q = self.outgoing.lock().ok()?;
        q.get(to.as_bytes())?
            .iter()
            .find(|(o, _)| !skip.contains(o.id()))
            .map(|(o, _)| o.clone())
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
            if let Ok(mut q) = self.outgoing.lock() {
                if let Some(queue) = q.get_mut(to.as_bytes()) {
                    queue.retain(|(o, _)| o.id() != id);
                }
            }
        }
    }
}
