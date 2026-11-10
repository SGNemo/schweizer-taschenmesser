//! The PC's side of the permission: the master switch, the per-device grant and the one controller
//! slot. Every setter here is reached only from the PC's own controls (the shell's desktop
//! commands); no frame from the network ever calls one.
//!
//! Widening (switching the master switch on, a higher level, lifting a pause, dropping the unlock
//! request) needs a [`Ticket`]: the shell takes one, asks in its native dialog, and passes the
//! ticket to the setter. The setter refuses if a mouse/keyboard session is open now **or was
//! opened at any moment since the ticket was taken** – such a session could have clicked the PC's
//! own confirmation, also if it is gone again by the time the dialog returns. A session counts as
//! open until its connection has really finished (buttons let go), not just until it was told to
//! end.

use super::wire::{Code, Level};
use crate::noise::PublicKey;
use crate::trust::{RemoteGrant, SessionHandle, TrustError, TrustStore};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicU8, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

/// Could not read or write the switch. Carries no content.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SwitchError;

/// "Fernsteuerung erlauben" of this PC. Off by default; device-local, never synced.
pub trait MasterSwitch: Send + Sync {
    fn enabled(&self) -> bool;
    fn set(&self, on: bool) -> Result<(), SwitchError>;
}

/// Switch for tests and tools.
#[derive(Default)]
pub struct MemorySwitch(AtomicBool);

impl MemorySwitch {
    pub fn new() -> Self {
        Self::default()
    }
}

impl MasterSwitch for MemorySwitch {
    fn enabled(&self) -> bool {
        self.0.load(Ordering::SeqCst)
    }
    fn set(&self, on: bool) -> Result<(), SwitchError> {
        self.0.store(on, Ordering::SeqCst);
        Ok(())
    }
}

#[derive(serde::Serialize, serde::Deserialize)]
struct SwitchFile {
    v: u32,
    enabled: bool,
}

/// The switch in a JSON file next to the trust list, written atomically. A missing file is "off";
/// a file that cannot be read or parsed is an error (the caller then runs without remote control,
/// it never guesses "on").
pub struct FileSwitch {
    path: PathBuf,
    on: AtomicBool,
    io: Mutex<()>,
}

impl FileSwitch {
    pub fn open(path: &Path) -> Result<Self, SwitchError> {
        let on = match std::fs::read(path) {
            Ok(bytes) => {
                let f: SwitchFile = serde_json::from_slice(&bytes).map_err(|_| SwitchError)?;
                if f.v != 1 {
                    return Err(SwitchError);
                }
                f.enabled
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => false,
            Err(_) => return Err(SwitchError),
        };
        Ok(FileSwitch {
            path: path.to_owned(),
            on: AtomicBool::new(on),
            io: Mutex::new(()),
        })
    }
}

impl MasterSwitch for FileSwitch {
    fn enabled(&self) -> bool {
        self.on.load(Ordering::SeqCst)
    }

    /// Off takes effect at once, also when it cannot be written; on only once it is on disk.
    fn set(&self, on: bool) -> Result<(), SwitchError> {
        let _g = self.io.lock().map_err(|_| SwitchError)?;
        if !on {
            self.on.store(false, Ordering::SeqCst);
        }
        let bytes =
            serde_json::to_vec(&SwitchFile { v: 1, enabled: on }).map_err(|_| SwitchError)?;
        let mut tmp = self.path.clone().into_os_string();
        tmp.push(".tmp");
        crate::trust::file::write_synced(&tmp, &bytes).map_err(|_| SwitchError)?;
        std::fs::rename(&tmp, &self.path).map_err(|_| SwitchError)?;
        self.on.store(on, Ordering::SeqCst);
        Ok(())
    }
}

/// Why one of the PC's own controls refused.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ControlError {
    /// A device controls mouse and keyboard right now, or did since the confirmation was asked
    /// for: nothing is widened. Ask again once that session has ended.
    BusyControlled,
    /// A widening without a [`Ticket`]: the confirmation at the PC was skipped.
    Unconfirmed,
    /// No such active device.
    NotFound,
    Storage,
}

/// What the PC shows: is remote control allowed at all, and who controls right now at which level.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Status {
    pub enabled: bool,
    pub controller: Option<(PublicKey, Level)>,
}

/// Proof that a widening was asked for before the PC's confirmation was shown: it remembers how
/// many mouse/keyboard sessions had been opened by then. Not `Clone`, and a setter takes it by
/// value: one confirmation, one widening.
#[derive(Debug)]
pub struct Ticket(u64);

/// `end` of a controller: 0 = live, a [`Code`] byte = the PC ended it with that reason,
/// [`REPLACED`] = the same device opened a new session (closed without a reason).
const LIVE: u8 = 0;
const REPLACED: u8 = 0xff;

/// The mark of the session that holds the controller slot. The session reads it before every event.
pub(crate) struct Flag {
    end: AtomicU8,
    handle: SessionHandle,
    level: Level,
}

/// How a controller's session ended from the PC's side.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Ended {
    /// Tell the phone why, then close.
    With(Code),
    /// Close without a word (the device itself opened a newer session).
    Silently,
}

impl Flag {
    pub(crate) fn ended(&self) -> Option<Ended> {
        match self.end.load(Ordering::SeqCst) {
            LIVE => None,
            REPLACED => Some(Ended::Silently),
            b => Some(Code::from_byte(b).map_or(Ended::Silently, Ended::With)),
        }
    }

    fn live(&self) -> bool {
        self.end.load(Ordering::SeqCst) == LIVE && !self.handle.is_closed()
    }

    /// The first reason sticks.
    fn end_with(&self, reason: u8) {
        let _ = self
            .end
            .compare_exchange(LIVE, reason, Ordering::SeqCst, Ordering::SeqCst);
    }
}

struct Controller {
    peer: PublicKey,
    level: Level,
    flag: Arc<Flag>,
}

pub struct Remote {
    trust: Arc<dyn TrustStore>,
    switch: Arc<dyn MasterSwitch>,
    slot: Mutex<Option<Controller>>,
    /// Mouse/keyboard sessions that were claimed and whose connection has not finished yet (a
    /// session that was told to end still counts until it let go of everything).
    full_active: AtomicUsize,
    /// Mouse/keyboard sessions ever claimed (what a [`Ticket`] remembers).
    full_claims: AtomicU64,
    /// The device of the latest of them (for the PC's notice; nothing is derived from it).
    full_last: Mutex<Option<PublicKey>>,
}

impl Remote {
    pub fn new(trust: Arc<dyn TrustStore>, switch: Arc<dyn MasterSwitch>) -> Self {
        Remote {
            trust,
            switch,
            slot: Mutex::new(None),
            full_active: AtomicUsize::new(0),
            full_claims: AtomicU64::new(0),
            full_last: Mutex::new(None),
        }
    }

    pub fn enabled(&self) -> bool {
        self.switch.enabled()
    }

    /// The stored grant of an active device (none for an unknown or revoked one).
    pub fn grant_of(&self, key: &PublicKey) -> RemoteGrant {
        self.trust.remote_of(key)
    }

    pub fn status(&self) -> Status {
        Status {
            enabled: self.enabled(),
            controller: self.live_controller(),
        }
    }

    fn live_controller(&self) -> Option<(PublicKey, Level)> {
        let slot = self.slot.lock().ok()?;
        slot.as_ref()
            .filter(|c| c.flag.live())
            .map(|c| (c.peer, c.level))
    }

    /// Whether a mouse/keyboard session is open right now: claimed, and its connection not yet
    /// finished. Being told to end is not enough – what it already took in may still be acting.
    pub fn full_session_open(&self) -> bool {
        self.full_active.load(Ordering::SeqCst) > 0
    }

    /// How many mouse/keyboard sessions were opened since this hub started, and whose the latest
    /// was. The PC's notice watches the number: it moves with every such session, however short,
    /// and never for a media session, whatever the device's grant.
    pub fn full_opened(&self) -> (u64, Option<PublicKey>) {
        // the device is written before the number moves, so a new number never comes with an
        // older device
        let count = self.full_claims.load(Ordering::SeqCst);
        let last = self.full_last.lock().ok().and_then(|l| *l);
        (count, last)
    }

    /// Taken **before** the PC's confirmation is shown; passed to the setter afterwards.
    pub fn ticket(&self) -> Ticket {
        Ticket(self.full_claims.load(Ordering::SeqCst))
    }

    /// A widening goes through only with a ticket, with no mouse/keyboard session open, and with
    /// none opened since the ticket was taken.
    fn may_widen(&self, ticket: Option<Ticket>) -> Result<(), ControlError> {
        let ticket = ticket.ok_or(ControlError::Unconfirmed)?;
        if self.full_session_open() || ticket.0 != self.full_claims.load(Ordering::SeqCst) {
            return Err(ControlError::BusyControlled);
        }
        Ok(())
    }

    /// The master switch. Switching on is a widening (it needs a ticket). Switching off needs
    /// none: the controlling session is told `remote-off` and stops at its next frame or tick;
    /// every later `open` is refused. Sync sessions are not touched.
    pub fn set_enabled(&self, on: bool, ticket: Option<Ticket>) -> Result<(), ControlError> {
        if on {
            if self.enabled() {
                return Ok(());
            }
            self.may_widen(ticket)?;
            return self.switch.set(true).map_err(|_| ControlError::Storage);
        }
        let stored = self.switch.set(false);
        // whatever the file said: the switch reads off now
        self.end_controller(None, Code::RemoteOff.byte());
        stored.map_err(|_| ControlError::Storage)
    }

    /// Sets the grant of one device. A widening needs a ticket (see [`Ticket`]). If that device
    /// controls right now, its session ends: with a reason when nothing is left for it, without a
    /// word when it may simply open again (so it learns its new grant with the next `opened`).
    pub fn set_grant(
        &self,
        key: &PublicKey,
        grant: RemoteGrant,
        ticket: Option<Ticket>,
    ) -> Result<(), ControlError> {
        let old = self.trust.remote_of(key);
        let widens = grant.widens(&old);
        if widens {
            self.may_widen(ticket)?;
        }
        let stored = self.trust.set_remote(key, grant).map_err(|e| match e {
            TrustError::NotFound | TrustError::Revoked => ControlError::NotFound,
            _ => ControlError::Storage,
        });
        // a change that could not be written: a widening did not happen (the store rolled it
        // back); anything else may hold in memory, so the session ends all the same
        if grant != old && (stored.is_ok() || !widens) {
            let reason = match grant.effective() {
                Level::Off if grant.paused => Code::Paused.byte(),
                Level::Off => Code::NotGranted.byte(),
                _ => REPLACED,
            };
            self.end_controller(Some(key), reason);
        }
        stored
    }

    /// "Fernsteuerung beenden": ends the controlling session and pauses that device until someone
    /// at the PC switches it on again. Returns the device, or `None` if nobody controlled.
    pub fn end(&self) -> Option<PublicKey> {
        let (peer, _) = self.live_controller()?;
        // the session is told first, so it stops whatever the store then says
        self.end_controller(Some(&peer), Code::Ended.byte());
        let mut grant = self.trust.remote_of(&peer);
        grant.paused = true;
        // a pause that cannot be written still holds in memory (a narrowing is never rolled back)
        let _ = self.trust.set_remote(&peer, grant);
        Some(peer)
    }

    /// The bind a session came in on is no longer the home network: whoever controls stops.
    pub(crate) fn home_lost(&self) {
        self.end_controller(None, REPLACED);
    }

    fn end_controller(&self, only: Option<&PublicKey>, reason: u8) {
        if let Ok(slot) = self.slot.lock() {
            if let Some(c) = slot
                .as_ref()
                .filter(|c| only.map_or(true, |p| c.peer == *p))
            {
                c.flag.end_with(reason);
            }
        }
    }

    /// What an `open` for `asked` would get: the session's level (the smaller of asked and
    /// granted) and the device's grant – or the reason for the phone. Reads only.
    pub(crate) fn level_for(
        &self,
        peer: &PublicKey,
        asked: Level,
    ) -> Result<(Level, RemoteGrant), Code> {
        if !self.enabled() {
            return Err(Code::RemoteOff);
        }
        let grant = self.trust.remote_of(peer);
        if grant.paused {
            return Err(Code::Paused);
        }
        let level = asked.min(grant.level);
        if level == Level::Off {
            return Err(Code::NotGranted);
        }
        Ok((level, grant))
    }

    /// An `open` from the network asks for the slot. Returns the session's level, the device's
    /// grant and the session's flag – or the reason for the phone. This reads the switch and the
    /// grant; it never changes either.
    pub(crate) fn claim(
        &self,
        peer: PublicKey,
        asked: Level,
        handle: SessionHandle,
    ) -> Result<Claimed, Code> {
        let mut slot = self.slot.lock().map_err(|_| Code::Busy)?;
        // decided under the slot's lock, so two opens cannot both see it free
        let (level, grant) = self.level_for(&peer, asked)?;
        if let Some(c) = slot.as_ref().filter(|c| c.flag.live()) {
            if c.peer != peer {
                return Err(Code::Busy);
            }
            // the same device moves on (media → full, or a reconnect): its older session ends
            // (and lets go of what it held, itself, when its connection finishes)
            c.flag.end_with(REPLACED);
        }
        let flag = Arc::new(Flag {
            end: AtomicU8::new(LIVE),
            handle,
            level,
        });
        if level == Level::Full {
            self.full_active.fetch_add(1, Ordering::SeqCst);
            if let Ok(mut last) = self.full_last.lock() {
                *last = Some(peer);
            }
            self.full_claims.fetch_add(1, Ordering::SeqCst);
        }
        *slot = Some(Controller {
            peer,
            level,
            flag: flag.clone(),
        });
        Ok(Claimed { level, grant, flag })
    }

    /// The session of `flag` has finished (its buttons are let go). Called exactly once per claim.
    pub(crate) fn release(&self, flag: &Arc<Flag>) {
        if flag.level == Level::Full {
            self.full_active.fetch_sub(1, Ordering::SeqCst);
        }
        if let Ok(mut slot) = self.slot.lock() {
            if slot.as_ref().is_some_and(|c| Arc::ptr_eq(&c.flag, flag)) {
                *slot = None;
            }
        }
    }
}

/// What an accepted `open` got.
pub(crate) struct Claimed {
    pub level: Level,
    pub grant: RemoteGrant,
    pub flag: Arc<Flag>,
}
