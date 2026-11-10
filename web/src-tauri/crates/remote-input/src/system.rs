//! The system calls behind the commands, as a trait so the worker's logic runs in tests anywhere.
//! The Windows implementation is the only real one.

use crate::{percent, stepped, Command, State};

/// The PC as the worker sees it. Every method is called on the worker thread only. `None`/`false`
/// = it could not be done or read; the worker carries on.
pub trait System {
    fn volume(&mut self) -> Option<f32>;
    fn set_volume(&mut self, volume: f32) -> bool;
    fn mute(&mut self) -> Option<bool>;
    fn set_mute(&mut self, mute: bool) -> bool;
    /// `PlayPause`, `Next` or `Previous` to the system's current media session.
    fn media(&mut self, command: Command) -> bool;
    fn playing(&mut self) -> Option<bool>;
    fn lock(&mut self) -> bool;
    fn locked(&mut self) -> Option<bool>;
}

/// Carries out one command.
pub(crate) fn apply(sys: &mut dyn System, command: Command) {
    match command {
        Command::PlayPause | Command::Next | Command::Previous => {
            sys.media(command);
        }
        Command::VolumeUp => {
            if let Some(v) = sys.volume() {
                sys.set_volume(stepped(v, true));
            }
            // "louder" on a muted PC must be heard
            if sys.mute() == Some(true) {
                sys.set_mute(false);
            }
        }
        Command::VolumeDown => {
            if let Some(v) = sys.volume() {
                sys.set_volume(stepped(v, false));
            }
        }
        Command::MuteToggle => {
            if let Some(m) = sys.mute() {
                sys.set_mute(!m);
            }
        }
        Command::Lock => {
            sys.lock();
        }
    }
}

/// Reads the four facts. What cannot be read is "no volume", "not muted", "not playing" – and
/// "locked".
pub(crate) fn read(sys: &mut dyn System) -> State {
    State {
        volume: sys.volume().map(percent),
        mute: sys.mute().unwrap_or(false),
        playing: sys.playing().unwrap_or(false),
        locked: sys.locked().unwrap_or(true),
    }
}

/// The real system, created on the worker thread. `None` where this PC cannot be controlled.
pub(crate) fn native() -> Option<Box<dyn System>> {
    imp::native()
}

/// Whether [`native`] can work here at all (decided at compile time).
pub(crate) const SUPPORTED: bool = cfg!(windows);

#[cfg(not(windows))]
mod imp {
    use super::System;

    pub fn native() -> Option<Box<dyn System>> {
        None
    }
}

#[cfg(windows)]
mod imp {
    use super::System;
    use crate::Command;
    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSession as Session,
        GlobalSystemMediaTransportControlsSessionManager as Manager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus as Playback,
    };
    use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
    use windows::Win32::Media::Audio::{
        eMultimedia, eRender, IMMDeviceEnumerator, MMDeviceEnumerator,
    };
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED,
    };
    use windows::Win32::System::RemoteDesktop::{
        WTSFreeMemory, WTSQuerySessionInformationW, WTSSessionInfoEx, WTSINFOEXW,
        WTS_CURRENT_SERVER_HANDLE, WTS_CURRENT_SESSION, WTS_SESSIONSTATE_LOCK,
        WTS_SESSIONSTATE_UNLOCK,
    };
    use windows::Win32::System::Shutdown::LockWorkStation;

    pub fn native() -> Option<Box<dyn System>> {
        // SAFETY: initialises COM for this (the worker) thread, which lives as long as the
        // process uses the worker; never uninitialised, so no object outlives its apartment.
        let ok = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) }.is_ok();
        ok.then(|| Box::new(Windows { manager: None }) as Box<dyn System>)
    }

    struct Windows {
        /// The media session manager, asked for once and kept.
        manager: Option<Manager>,
    }

    impl Windows {
        /// The default playback device's volume control. Looked up every time: the default
        /// device changes when headphones are plugged in.
        fn endpoint(&self) -> Option<IAudioEndpointVolume> {
            // SAFETY: COM calls on smart pointers; COM is initialised on this thread (`native`).
            unsafe {
                let devices: IMMDeviceEnumerator =
                    CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).ok()?;
                let device = devices.GetDefaultAudioEndpoint(eRender, eMultimedia).ok()?;
                device
                    .Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None)
                    .ok()
            }
        }

        /// The session the system itself calls current (the one its media keys would reach).
        fn session(&mut self) -> Option<Session> {
            if self.manager.is_none() {
                self.manager = Manager::RequestAsync().ok()?.get().ok();
            }
            self.manager.as_ref()?.GetCurrentSession().ok()
        }
    }

    impl System for Windows {
        fn volume(&mut self) -> Option<f32> {
            let endpoint = self.endpoint()?;
            // SAFETY: a COM call on a live interface pointer.
            unsafe { endpoint.GetMasterVolumeLevelScalar() }.ok()
        }

        fn set_volume(&mut self, volume: f32) -> bool {
            let Some(endpoint) = self.endpoint() else {
                return false;
            };
            // SAFETY: a COM call on a live interface pointer; a null event context is allowed.
            unsafe { endpoint.SetMasterVolumeLevelScalar(volume, std::ptr::null()) }.is_ok()
        }

        fn mute(&mut self) -> Option<bool> {
            let endpoint = self.endpoint()?;
            // SAFETY: a COM call on a live interface pointer.
            unsafe { endpoint.GetMute() }.ok().map(|m| m.as_bool())
        }

        fn set_mute(&mut self, mute: bool) -> bool {
            let Some(endpoint) = self.endpoint() else {
                return false;
            };
            // SAFETY: a COM call on a live interface pointer; a null event context is allowed.
            unsafe { endpoint.SetMute(mute, std::ptr::null()) }.is_ok()
        }

        fn media(&mut self, command: Command) -> bool {
            let Some(session) = self.session() else {
                return false;
            };
            let asked = match command {
                Command::PlayPause => session.TryTogglePlayPauseAsync(),
                Command::Next => session.TrySkipNextAsync(),
                Command::Previous => session.TrySkipPreviousAsync(),
                _ => return false,
            };
            asked.and_then(|op| op.get()).unwrap_or(false)
        }

        fn playing(&mut self) -> Option<bool> {
            let status = self
                .session()?
                .GetPlaybackInfo()
                .ok()?
                .PlaybackStatus()
                .ok()?;
            Some(status == Playback::Playing)
        }

        fn lock(&mut self) -> bool {
            // SAFETY: takes no arguments; asks Windows to lock the workstation.
            unsafe { LockWorkStation() }.is_ok()
        }

        fn locked(&mut self) -> Option<bool> {
            let mut data = windows::core::PWSTR::null();
            let mut len = 0u32;
            // SAFETY: Windows allocates the buffer and reports its size; it is checked, read as
            // the structure this information class returns, and freed below.
            unsafe {
                WTSQuerySessionInformationW(
                    Some(WTS_CURRENT_SERVER_HANDLE),
                    WTS_CURRENT_SESSION,
                    WTSSessionInfoEx,
                    &mut data,
                    &mut len,
                )
                .ok()?;
                let flags = if !data.is_null() && len as usize >= std::mem::size_of::<WTSINFOEXW>()
                {
                    let info = std::ptr::read_unaligned(data.0.cast::<WTSINFOEXW>());
                    (info.Level == 1).then_some(info.Data.WTSInfoExLevel1.SessionFlags)
                } else {
                    None
                };
                WTSFreeMemory(data.0.cast());
                match flags? as u32 {
                    WTS_SESSIONSTATE_LOCK => Some(true),
                    WTS_SESSIONSTATE_UNLOCK => Some(false),
                    _ => None,
                }
            }
        }
    }
}
