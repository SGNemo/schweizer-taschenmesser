//! The PC's side of the permission: the master switch, the per-device grant and the one controller
//! slot. Every setter here is reached only from the PC's own controls (the shell's desktop
//! commands); no frame from the network ever calls one.
//!
//! Widening (switching the master switch on, a higher level, lifting a pause, dropping the unlock
//! request) is refused while a mouse/keyboard session is open: that session could click the PC's
//! own confirmation. The shell asks in a native dialog first and calls the setter afterwards, so
//! the check here is the one that runs *after* the dialog returned.

use super::wire::{Code, Level};
use crate::noise::PublicKey;
use crate::trust::{RemoteGrant, SessionHandle, SessionRegistry, TrustError, TrustStore};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};
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
    /// A device controls mouse and keyboard right now: nothing is widened until that session ended.
    BusyControlled,
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

/// `end` of a controller: 0 = live, a [`Code`] byte = the PC ended it with that reason,
/// [`REPLACED`] = the same device opened a new session (closed without a reason).
const LIVE: u8 = 0;
const REPLACED: u8 = 0xff;

/// The mark of the session that holds the controller slot. The session reads it before every event.
pub(crate) struct Flag {
    end: AtomicU8,
    handle: SessionHandle,
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
    sessions: Arc<SessionRegistry>,
    slot: Mutex<Option<Controller>>,
}

impl Remote {
    pub fn new(
        trust: Arc<dyn TrustStore>,
        switch: Arc<dyn MasterSwitch>,
        sessions: Arc<SessionRegistry>,
    ) -> Self {
        Remote {
            trust,
            switch,
            sessions,
            slot: Mutex::new(None),
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

    /// Whether a mouse/keyboard session is open right now. A slot that cannot be read counts as
    /// "yes" (nothing is widened on a doubt).
    pub fn full_session_open(&self) -> bool {
        match self.slot.lock() {
            Ok(slot) => slot
                .as_ref()
                .is_some_and(|c| c.flag.live() && c.level == Level::Full),
            Err(_) => true,
        }
    }

    /// The master switch. Off ends every input session at once (sync sessions are not touched).
    pub fn set_enabled(&self, on: bool) -> Result<(), ControlError> {
        if on {
            if !self.enabled() && self.full_session_open() {
                return Err(ControlError::BusyControlled);
            }
            return self.switch.set(true).map_err(|_| ControlError::Storage);
        }
        let stored = self.switch.set(false);
        // whatever the file said: the switch reads off now, and the sessions go
        self.end_controller(None, Code::RemoteOff);
        self.sessions.close_input(None);
        stored.map_err(|_| ControlError::Storage)
    }

    /// Sets the grant of one device. A widening is refused while a mouse/keyboard session is open;
    /// a narrowing below the level of that device's open session ends the session.
    pub fn set_grant(&self, key: &PublicKey, grant: RemoteGrant) -> Result<(), ControlError> {
        let old = self.trust.remote_of(key);
        if grant.widens(&old) && self.full_session_open() {
            return Err(ControlError::BusyControlled);
        }
        self.trust.set_remote(key, grant).map_err(|e| match e {
            TrustError::NotFound | TrustError::Revoked => ControlError::NotFound,
            _ => ControlError::Storage,
        })?;
        if let Ok(slot) = self.slot.lock() {
            if let Some(c) = slot.as_ref().filter(|c| c.peer == *key) {
                if grant.effective() < c.level {
                    let code = if grant.paused {
                        Code::Paused
                    } else {
                        Code::NotGranted
                    };
                    c.flag.end_with(code.byte());
                }
            }
        }
        Ok(())
    }

    /// "Fernsteuerung beenden": ends the controlling session and pauses that device until someone
    /// at the PC switches it on again. Returns the device, or `None` if nobody controlled.
    pub fn end(&self) -> Option<PublicKey> {
        let (peer, _) = self.live_controller()?;
        // the session is told first, so it stops whatever the store then says
        self.end_controller(Some(&peer), Code::Ended);
        let mut grant = self.trust.remote_of(&peer);
        grant.paused = true;
        if self.trust.set_remote(&peer, grant).is_err() {
            // the pause could not be stored: still no input from this device for now
            self.sessions.close_input(Some(&peer));
        }
        Some(peer)
    }

    fn end_controller(&self, only: Option<&PublicKey>, code: Code) {
        if let Ok(slot) = self.slot.lock() {
            if let Some(c) = slot
                .as_ref()
                .filter(|c| only.map_or(true, |p| c.peer == *p))
            {
                c.flag.end_with(code.byte());
            }
        }
    }

    /// An `open` from the network asks for the slot. Returns the session's level (the smaller of
    /// asked and granted), the device's grant and the session's flag – or the reason for the phone.
    /// This reads the switch and the grant; it never changes either.
    pub(crate) fn claim(
        &self,
        peer: PublicKey,
        asked: Level,
        handle: SessionHandle,
    ) -> Result<(Level, RemoteGrant, Arc<Flag>), Code> {
        if !self.enabled() {
            return Err(Code::RemoteOff);
        }
        let grant = self.trust.remote_of(&peer);
        if grant.paused {
            return Err(Code::Paused);
        }
        let level = asked.min(grant.level);
        if level == Level::Off {
            return Err(Code::NotGranted);
        }
        let mut slot = self.slot.lock().map_err(|_| Code::Busy)?;
        if let Some(c) = slot.as_ref().filter(|c| c.flag.live()) {
            if c.peer != peer {
                return Err(Code::Busy);
            }
            // the same device moves on (media → full, or a reconnect): its older session ends
            c.flag.end_with(REPLACED);
        }
        let flag = Arc::new(Flag {
            end: AtomicU8::new(LIVE),
            handle,
        });
        *slot = Some(Controller {
            peer,
            level,
            flag: flag.clone(),
        });
        Ok((level, grant, flag))
    }

    /// The session of `flag` is gone: frees the slot if it still holds it.
    pub(crate) fn release(&self, flag: &Arc<Flag>) {
        if let Ok(mut slot) = self.slot.lock() {
            if slot.as_ref().is_some_and(|c| Arc::ptr_eq(&c.flag, flag)) {
                *slot = None;
            }
        }
    }
}
