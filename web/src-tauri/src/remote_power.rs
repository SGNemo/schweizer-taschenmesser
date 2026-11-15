//! Power at the PC (desktop only): the countdown before a phone's "Ausschalten" acts. Rules:
//! `docs/rules/remote-control.md`; plan: `docs/design/remote-power-deep/PLAN.md`.
//!
//! The hub (`lan_sync::input`) has already checked the session, the device's power permission and
//! the lock state; it hands the action to the sink, which hands it here. This file
//! * keeps the one countdown of this PC ([`Machine`], plain logic, tested below): one at a time,
//!   2 starts per minute per device, 10 minutes of quiet for a device after someone at the PC
//!   stopped its countdown, and its power permission taken away after the second such stop
//!   within an hour – all in memory, across sessions;
//! * shows the countdown in its own small window (`power.html`, capability `power.json`: status
//!   and cancel only). No window, or a window that is hidden, minimised or closed: no action;
//! * stops it when someone at the PC presses _Abbrechen_ or ends remote control in the tray, when
//!   the phone sends `cancel`, when the master switch goes off, when the device's power
//!   permission is taken away or paused, when the PC is locked, and when the hub stops. A phone
//!   that loses its connection does **not** stop it ("PC aus, Handy weg");
//! * asks Windows only when the countdown ran out (the power call of the input crate, never
//!   forced).
//!
//! No Tauri command starts a power action: the two commands here read the countdown and stop it,
//! the third tells what the web app is busy with (it can only add a hint). Nothing is logged.

use ::lan_sync::input::wire::{Power, PowerAnswer};
use ::lan_sync::noise::PublicKey;
use serde::Serialize;
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};

/// How long the PC counts down before it acts.
pub const COUNTDOWN: Duration = Duration::from_secs(10);
/// Starts per device in [`START_WINDOW`].
const STARTS: usize = 2;
const START_WINDOW: Duration = Duration::from_secs(60);
/// After a countdown was stopped at the PC, that device starts none for this long.
const QUIET_AFTER_PC_CANCEL: Duration = Duration::from_secs(10 * 60);
/// A second stop at the PC within this time takes the device's power permission away.
const SECOND_CANCEL_WITHIN: Duration = Duration::from_secs(60 * 60);
/// The window must be on screen within this time, or nothing happens.
const SHOW_WITHIN: Duration = Duration::from_secs(5);
/// The page asks every quarter second; quiet for longer than this, it counts as not on screen (a
/// hung page shows no button).
const POLL_FRESH: Duration = Duration::from_millis(1500);
/// The label of the countdown window (`capabilities/power.json` names it).
pub const WINDOW: &str = "remote-power";

/// What the web app reports it is busy with (bits): cloud sync, backup.
pub const BUSY_SYNC: u8 = 1;
pub const BUSY_BACKUP: u8 = 2;

/// The actions a countdown can end in.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Act {
    Sleep,
    Hibernate,
    SignOut,
    Restart,
    ShutDown,
}

impl Act {
    fn of(power: Power) -> Option<Act> {
        Some(match power {
            Power::Sleep => Act::Sleep,
            Power::Hibernate => Act::Hibernate,
            Power::SignOut => Act::SignOut,
            Power::Restart => Act::Restart,
            Power::ShutDown => Act::ShutDown,
            Power::Cancel => return None,
        })
    }

    fn system(self) -> remote_input::PowerAction {
        match self {
            Act::Sleep => remote_input::PowerAction::Sleep,
            Act::Hibernate => remote_input::PowerAction::Hibernate,
            Act::SignOut => remote_input::PowerAction::SignOut,
            Act::Restart => remote_input::PowerAction::Restart,
            Act::ShutDown => remote_input::PowerAction::ShutDown,
        }
    }
}

type Device = [u8; 32];

struct Running {
    device: Device,
    act: Act,
    began: Instant,
    /// When the window's page last asked for the countdown (it is loaded and shows the button).
    last_poll: Option<Instant>,
    /// When the window was first on screen with its page loaded; the 10 s count from here.
    shown_at: Option<Instant>,
}

/// How a tick ended a countdown.
#[derive(Debug, PartialEq, Eq)]
pub enum Tick {
    Nothing,
    /// It ran out: do it now.
    Fire(Act),
    /// It was stopped (or the window never came): close the window.
    Stopped,
    /// The window that was on screen went away (closed, hidden, minimised): a stop at the PC.
    /// `revoke`: the second within an hour – the device's power permission goes.
    StoppedAtPc {
        device: Device,
        revoke: bool,
    },
}

/// The countdown's logic, apart from windows and clocks (time comes in as an argument).
#[derive(Default)]
pub struct Machine {
    running: Option<Running>,
    starts: Vec<(Device, Instant)>,
    pc_cancels: Vec<(Device, Instant)>,
    news: Option<(u64, Device, PowerAnswer)>,
}

impl Machine {
    /// A power action of `device` that passed the hub's gate. `busy`: Nemo on this PC is still
    /// working (the phone is told first, unless it asks `despite` that).
    pub fn request(
        &mut self,
        device: Device,
        power: Power,
        despite: bool,
        busy: bool,
        now: Instant,
    ) -> PowerAnswer {
        let Some(act) = Act::of(power) else {
            // stopping is always allowed (any controlling device; there is one at a time); the
            // news belongs to the countdown's own device
            if let Some(run) = self.running.take() {
                self.tell(run.device, PowerAnswer::Cancelled);
            }
            return PowerAnswer::Cancelled;
        };
        self.forget_old(now);
        if self
            .pc_cancels
            .iter()
            .any(|(d, at)| *d == device && now.duration_since(*at) < QUIET_AFTER_PC_CANCEL)
        {
            return PowerAnswer::Limit;
        }
        if self.running.is_some() {
            return PowerAnswer::Pending;
        }
        if self.starts.iter().filter(|(d, _)| *d == device).count() >= STARTS {
            return PowerAnswer::Limit;
        }
        if busy && !despite {
            return PowerAnswer::Working;
        }
        self.starts.push((device, now));
        self.running = Some(Running {
            device,
            act,
            began: now,
            last_poll: None,
            shown_at: None,
        });
        PowerAnswer::Started
    }

    /// The window's page asked for the countdown: it is loaded and alive.
    pub fn polled(&mut self, now: Instant) {
        if let Some(run) = self.running.as_mut() {
            run.last_poll = Some(now);
        }
    }

    /// The window could not be created: the countdown is over before it began.
    pub fn no_window(&mut self) {
        self.running = None;
    }

    /// Looks at the countdown. `allowed`: the device may still do this (switch on, permission
    /// there, not paused). `locked`: the PC is locked. `visible`: the window is on screen (not
    /// hidden, not minimised).
    pub fn tick(
        &mut self,
        now: Instant,
        allowed: impl Fn(&Device) -> bool,
        locked: bool,
        visible: bool,
    ) -> Tick {
        let Some(run) = self.running.as_mut() else {
            return Tick::Nothing;
        };
        let alive = run
            .last_poll
            .is_some_and(|at| now.saturating_duration_since(at) < POLL_FRESH);
        if visible && alive && run.shown_at.is_none() {
            run.shown_at = Some(now);
        }
        let device = run.device;
        // shown once, then its page went quiet (hung, crashed): no button to press any more
        let hung = run.shown_at.is_some() && visible && !alive;
        if locked || hung || !allowed(&device) {
            self.running = None;
            self.tell(device, PowerAnswer::Cancelled);
            return Tick::Stopped;
        }
        match run.shown_at {
            // on screen, then gone: someone at the PC closed, hid or minimised it
            Some(_) if !visible => {
                let revoke = self.stopped_at_pc(now).is_some_and(|(_, r)| r);
                Tick::StoppedAtPc { device, revoke }
            }
            // it acts only after it was on screen for the whole countdown
            Some(at) if now.saturating_duration_since(at) >= COUNTDOWN => {
                let act = run.act;
                self.running = None;
                self.tell(device, PowerAnswer::Done);
                Tick::Fire(act)
            }
            Some(_) => Tick::Nothing,
            None if now.saturating_duration_since(run.began) >= SHOW_WITHIN => {
                self.running = None;
                self.tell(device, PowerAnswer::Failed);
                Tick::Stopped
            }
            None => Tick::Nothing,
        }
    }

    /// The action ran out but Windows refused at once.
    pub fn failed(&mut self, device: Device) {
        self.tell(device, PowerAnswer::Failed);
    }

    /// Someone at the PC stopped it (window, tray). Returns the device and whether its power
    /// permission is to be taken away (the second such stop within an hour).
    pub fn cancel_at_pc(&mut self, now: Instant) -> Option<(Device, bool)> {
        self.stopped_at_pc(now)
    }

    fn stopped_at_pc(&mut self, now: Instant) -> Option<(Device, bool)> {
        let run = self.running.take()?;
        self.tell(run.device, PowerAnswer::Cancelled);
        self.pc_cancels
            .retain(|(_, at)| now.duration_since(*at) < SECOND_CANCEL_WITHIN);
        let again = self.pc_cancels.iter().any(|(d, _)| *d == run.device);
        self.pc_cancels.push((run.device, now));
        Some((run.device, again))
    }

    /// The hub stopped: nothing may act any more.
    pub fn stop(&mut self) {
        if let Some(run) = self.running.take() {
            self.tell(run.device, PowerAnswer::Cancelled);
        }
    }

    /// Whose countdown runs, which action, and how long it has been on screen (zero until it is).
    pub fn running(&self, now: Instant) -> Option<(Device, Act, Duration)> {
        self.running.as_ref().map(|r| {
            let on_screen = r
                .shown_at
                .map_or(Duration::ZERO, |at| now.saturating_duration_since(at));
            (r.device, r.act, on_screen)
        })
    }

    pub fn news(&self) -> Option<(u64, Device, PowerAnswer)> {
        self.news
    }

    fn tell(&mut self, device: Device, answer: PowerAnswer) {
        let n = self.news.map_or(1, |(n, _, _)| n + 1);
        self.news = Some((n, device, answer));
    }

    fn forget_old(&mut self, now: Instant) {
        self.starts
            .retain(|(_, at)| now.duration_since(*at) < START_WINDOW);
    }
}

/// What the hub's other parts tell the countdown: is the device still allowed, is anything of
/// Nemo still working, how the device is called. Set while the hub runs.
pub struct Env {
    pub app: AppHandle,
    pub allowed: Box<dyn Fn(&PublicKey) -> bool + Send + Sync>,
    /// Another device than this one has an open sync session.
    pub other_sync: Box<dyn Fn(&PublicKey) -> bool + Send + Sync>,
    pub name: Box<dyn Fn(&PublicKey) -> String + Send + Sync>,
}

/// The countdown of this PC, shared by the sink (hub threads), the tray thread and the commands.
#[derive(Default)]
pub struct PowerCore {
    machine: Mutex<Machine>,
    env: Mutex<Option<Arc<Env>>>,
    /// What the web app said it is busy with ([`BUSY_SYNC`], [`BUSY_BACKUP`]).
    web_busy: AtomicU8,
}

impl PowerCore {
    fn machine(&self) -> std::sync::MutexGuard<'_, Machine> {
        self.machine.lock().unwrap_or_else(|e| e.into_inner())
    }

    fn env(&self) -> Option<Arc<Env>> {
        self.env.lock().ok().and_then(|e| e.clone())
    }

    /// The hub started (`remote::attach`).
    pub fn attach(&self, env: Env) {
        if let Ok(mut slot) = self.env.lock() {
            *slot = Some(Arc::new(env));
        }
    }

    /// The hub stopped: a running countdown ends without acting.
    pub fn detach(&self) {
        let env = self.env.lock().ok().and_then(|mut e| e.take());
        self.machine().stop();
        if let Some(env) = env {
            close_window(&env.app);
        }
    }

    fn busy(&self, env: &Env, device: &PublicKey) -> bool {
        let downloads = env
            .app
            .try_state::<crate::downloads::Downloads>()
            .is_some_and(|d| d.active());
        self.web_busy.load(Ordering::SeqCst) != 0 || downloads || (env.other_sync)(device)
    }

    /// From the hub's input session (via the sink): answers at once.
    pub fn request(&self, device: &PublicKey, power: Power, despite: bool) -> PowerAnswer {
        let Some(env) = self.env() else {
            return match power {
                Power::Cancel => PowerAnswer::Cancelled,
                _ => PowerAnswer::Failed,
            };
        };
        // a PC that cannot hibernate would hear "done" and stay on
        if power == Power::Hibernate && !remote_input::hibernate_available() {
            return PowerAnswer::Failed;
        }
        let busy = power != Power::Cancel && self.busy(&env, device);
        let was_running = self.counting().is_some();
        let answer =
            self.machine()
                .request(*device.as_bytes(), power, despite, busy, Instant::now());
        match answer {
            PowerAnswer::Started => {
                if show_window(&env.app).is_err() {
                    self.machine().no_window();
                    return PowerAnswer::Failed;
                }
                // stopped while the window was being built (tray, hub stop): no empty window
                if self.counting().is_none() {
                    close_window(&env.app);
                }
            }
            PowerAnswer::Cancelled if was_running => close_window(&env.app),
            _ => {}
        }
        answer
    }

    /// (a countdown runs, hibernate is available)
    pub fn info(&self) -> (bool, bool) {
        // (the lock is let go before the system is asked)
        let counting = self.counting().is_some();
        (counting, remote_input::hibernate_available())
    }

    pub fn news(&self) -> Option<(u64, PublicKey, PowerAnswer)> {
        self.machine()
            .news()
            .map(|(n, d, a)| (n, PublicKey::from_bytes(d), a))
    }

    /// Whose countdown runs (the tray shows "Fernsteuerung beenden" for it as well).
    pub fn counting(&self) -> Option<PublicKey> {
        self.machine()
            .running(Instant::now())
            .map(|(d, _, _)| PublicKey::from_bytes(d))
    }

    /// Called by the tray thread every quarter second while the hub runs. `locked` is asked only
    /// while a countdown runs (it reads the PC's state, which nobody should poll for nothing).
    /// Returns the device whose power permission is to be taken away (its window was closed at
    /// the PC for the second time within an hour).
    pub fn tick(&self, locked: impl FnOnce() -> bool) -> Option<PublicKey> {
        let env = self.env()?;
        if self.counting().is_none() {
            // a window that outlived its countdown (built while it was stopped) goes too
            if env.app.get_webview_window(WINDOW).is_some() {
                close_window(&env.app);
            }
            return None;
        }
        let locked = locked();
        let visible = env
            .app
            .get_webview_window(WINDOW)
            .is_some_and(|w| w.is_visible().unwrap_or(false) && !w.is_minimized().unwrap_or(true));
        let allowed = |d: &Device| (env.allowed)(&PublicKey::from_bytes(*d));
        let tick = self
            .machine()
            .tick(Instant::now(), allowed, locked, visible);
        match tick {
            Tick::Nothing => None,
            Tick::Stopped => {
                close_window(&env.app);
                None
            }
            Tick::StoppedAtPc { device, revoke } => {
                close_window(&env.app);
                revoke.then(|| PublicKey::from_bytes(device))
            }
            Tick::Fire(act) => {
                close_window(&env.app);
                let device = self.machine().news().map(|(_, d, _)| d);
                let core = env.app.state::<crate::remote::RemoteHost>().power_arc();
                // sleep returns only after the PC woke up again: never on the tray thread
                let _ = std::thread::Builder::new()
                    .name("remote-power".into())
                    .spawn(move || {
                        if !remote_input::power(act.system()) {
                            if let Some(d) = device {
                                core.machine().failed(d);
                            }
                        }
                    });
                None
            }
        }
    }

    /// _Abbrechen_ at the PC (window, tray). Returns the device whose power permission is to be
    /// taken away now (its second stop at the PC within an hour).
    pub fn cancel_at_pc(&self) -> Option<PublicKey> {
        let stopped = self.machine().cancel_at_pc(Instant::now());
        if let Some(env) = self.env() {
            close_window(&env.app);
        }
        stopped.and_then(|(d, revoke)| revoke.then(|| PublicKey::from_bytes(d)))
    }
}

fn show_window(app: &AppHandle) -> tauri::Result<()> {
    if let Some(w) = app.get_webview_window(WINDOW) {
        w.show()?;
        w.unminimize()?;
        return w.set_focus();
    }
    let lang = crate::capture::native_lang(app);
    let builder = WebviewWindowBuilder::new(app, WINDOW, WebviewUrl::App("power.html".into()))
        .title(crate::texts::power_title(lang))
        .inner_size(460.0, 240.0)
        // a long name at a large scale may need more room; it can grow, never shrink away
        .min_inner_size(400.0, 200.0)
        .resizable(true)
        .minimizable(false)
        .maximizable(false)
        .always_on_top(true)
        .focused(true)
        .center();
    // Same WebView2 profile as the main window (theme, language).
    #[cfg(windows)]
    let builder = match std::env::current_exe()
        .ok()
        .and_then(|exe| crate::portable::data_dir(&exe, &app.config().identifier))
    {
        Some(dir) => builder.data_directory(dir),
        None => builder,
    };
    builder.build().map(|_| ())
}

fn close_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(WINDOW) {
        let _ = w.destroy();
    }
}

// ---- commands ----

/// Everything the countdown window shows, worded here (the window has no texts of its own).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PowerStatusDto {
    /// "Svens Handy schaltet diesen PC in 7 Sekunden aus." – the device's name as plain text.
    text: String,
    note: &'static str,
    cancel: &'static str,
    lang: &'static str,
}

/// What the countdown window shows; `None` when nothing runs (the window then closes itself).
#[tauri::command(async)]
pub fn remote_power_status(
    app: AppHandle,
    state: State<'_, crate::remote::RemoteHost>,
) -> Result<Option<PowerStatusDto>, String> {
    let core = state.power();
    let Some(env) = core.env() else {
        return Ok(None);
    };
    let running = {
        let mut machine = core.machine();
        // the page asked: it is loaded and alive, and shows the button
        machine.polled(Instant::now());
        machine.running(Instant::now())
    };
    Ok(running.map(|(device, act, on_screen)| {
        let lang = crate::capture::native_lang(&app);
        let left = COUNTDOWN.saturating_sub(on_screen);
        let seconds = left.as_secs() + u64::from(left.subsec_nanos() > 0);
        let name = (env.name)(&PublicKey::from_bytes(device));
        PowerStatusDto {
            text: crate::texts::power_countdown(lang, &name, act, seconds),
            note: crate::texts::power_note(lang, act),
            cancel: crate::texts::power_cancel(lang),
            lang: if lang == crate::texts::Lang::De {
                "de"
            } else {
                "en"
            },
        }
    }))
}

/// _Abbrechen_ at the PC. Only ever stops something.
#[tauri::command(async)]
pub fn remote_power_cancel(state: State<'_, crate::remote::RemoteHost>) {
    crate::remote::power_cancelled_at_pc(&state);
}

/// What the web app is busy with right now (cloud sync, backup). It can only make the phone hear
/// "Nemo am PC arbeitet noch" before a countdown; it never starts or stops one.
#[tauri::command(async)]
pub fn remote_set_busy(state: State<'_, crate::remote::RemoteHost>, bits: u8) {
    state
        .power()
        .web_busy
        .store(bits & (BUSY_SYNC | BUSY_BACKUP), Ordering::SeqCst);
}

#[cfg(test)]
mod tests {
    use super::*;

    const PHONE: Device = [1; 32];
    const TABLET: Device = [2; 32];
    const YES: fn(&Device) -> bool = |_| true;

    fn at(t0: Instant, secs: u64) -> Instant {
        t0 + Duration::from_secs(secs)
    }

    /// A tick of a window whose page keeps asking (it is alive).
    fn look(
        m: &mut Machine,
        now: Instant,
        allowed: impl Fn(&Device) -> bool,
        locked: bool,
        visible: bool,
    ) -> Tick {
        m.polled(now);
        m.tick(now, allowed, locked, visible)
    }

    #[test]
    fn it_acts_only_after_ten_seconds_on_screen() {
        let t0 = Instant::now();
        let mut m = Machine::default();
        assert_eq!(
            m.request(PHONE, Power::ShutDown, false, false, t0),
            PowerAnswer::Started
        );
        // on screen but its page did not ask yet: the count has not begun
        assert_eq!(m.tick(at(t0, 0), YES, false, true), Tick::Nothing);
        assert_eq!(m.running(at(t0, 1)).unwrap().2, Duration::ZERO);
        m.polled(t0);
        assert_eq!(look(&mut m, at(t0, 0), YES, false, true), Tick::Nothing);
        assert_eq!(look(&mut m, at(t0, 9), YES, false, true), Tick::Nothing);
        assert_eq!(
            look(&mut m, at(t0, 10), YES, false, true),
            Tick::Fire(Act::ShutDown)
        );
        assert_eq!(
            m.news().map(|(_, d, a)| (d, a)),
            Some((PHONE, PowerAnswer::Done))
        );
        assert!(m.running(at(t0, 10)).is_none());
        assert_eq!(look(&mut m, at(t0, 11), YES, false, true), Tick::Nothing);
        // the ten seconds count from the moment it was on screen, however late that was
        let mut m = Machine::default();
        m.request(PHONE, Power::Restart, false, false, t0);
        m.polled(t0);
        assert_eq!(look(&mut m, at(t0, 2), YES, false, true), Tick::Nothing);
        assert_eq!(look(&mut m, at(t0, 11), YES, false, true), Tick::Nothing);
        assert_eq!(
            look(&mut m, at(t0, 12), YES, false, true),
            Tick::Fire(Act::Restart)
        );
    }

    #[test]
    fn no_window_no_action() {
        let t0 = Instant::now();
        let mut m = Machine::default();
        m.request(PHONE, Power::Sleep, false, false, t0);
        // never on screen
        m.polled(t0);
        assert_eq!(look(&mut m, at(t0, 1), YES, false, false), Tick::Nothing);
        assert_eq!(look(&mut m, at(t0, 4), YES, false, false), Tick::Nothing);
        assert_eq!(look(&mut m, at(t0, 5), YES, false, false), Tick::Stopped);
        assert_eq!(m.news().map(|(_, _, a)| a), Some(PowerAnswer::Failed));
        // on screen but its page never loaded (no button to press): the same
        let mut m = Machine::default();
        m.request(PHONE, Power::Sleep, false, false, t0);
        assert_eq!(m.tick(at(t0, 5), YES, false, true), Tick::Stopped);
        // on screen, then closed, hidden or minimised: a stop at the PC
        let mut m = Machine::default();
        m.request(PHONE, Power::Sleep, false, false, t0);
        m.polled(t0);
        assert_eq!(look(&mut m, at(t0, 1), YES, false, true), Tick::Nothing);
        assert_eq!(
            look(&mut m, at(t0, 2), YES, false, false),
            Tick::StoppedAtPc {
                device: PHONE,
                revoke: false
            }
        );
        assert_eq!(m.news().map(|(_, _, a)| a), Some(PowerAnswer::Cancelled));
        // … with its quiet time
        assert_eq!(
            m.request(PHONE, Power::Sleep, false, false, at(t0, 70)),
            PowerAnswer::Limit
        );
        // the window could not be made at all
        let mut m = Machine::default();
        m.request(PHONE, Power::Sleep, false, false, t0);
        m.no_window();
        assert!(m.running(t0).is_none());
    }

    #[test]
    fn every_stop_reason_stops_it() {
        let t0 = Instant::now();
        // permission gone (switch off, taken away, paused – the caller asks the hub)
        let mut m = Machine::default();
        m.request(PHONE, Power::Restart, false, false, t0);
        assert_eq!(m.tick(at(t0, 1), |_| false, false, true), Tick::Stopped);
        // the PC was locked
        let mut m = Machine::default();
        m.request(PHONE, Power::Restart, false, false, t0);
        assert_eq!(m.tick(at(t0, 1), YES, true, true), Tick::Stopped);
        // the phone
        let mut m = Machine::default();
        m.request(PHONE, Power::Restart, false, false, t0);
        // (another device's cancel stops it too, and the news is the countdown's own device's)
        assert_eq!(
            m.request(TABLET, Power::Cancel, false, false, t0),
            PowerAnswer::Cancelled
        );
        assert!(m.running(t0).is_none());
        assert_eq!(m.news().map(|(_, d, _)| d), Some(PHONE));
        // the hub stopped
        let mut m = Machine::default();
        m.request(PHONE, Power::Restart, false, false, t0);
        m.stop();
        assert!(m.running(t0).is_none());
        // the PC
        let mut m = Machine::default();
        m.request(PHONE, Power::Restart, false, false, t0);
        assert_eq!(m.cancel_at_pc(t0), Some((PHONE, false)));
        assert_eq!(m.tick(at(t0, 10), YES, false, true), Tick::Nothing);
    }

    #[test]
    fn one_at_a_time_and_two_starts_a_minute() {
        let t0 = Instant::now();
        let mut m = Machine::default();
        m.request(PHONE, Power::Sleep, false, false, t0);
        assert_eq!(
            m.request(TABLET, Power::ShutDown, false, false, t0),
            PowerAnswer::Pending
        );
        m.request(PHONE, Power::Cancel, false, false, t0);
        // a picked wrong action can be corrected once
        assert_eq!(
            m.request(PHONE, Power::Restart, false, false, at(t0, 1)),
            PowerAnswer::Started
        );
        m.request(PHONE, Power::Cancel, false, false, at(t0, 2));
        assert_eq!(
            m.request(PHONE, Power::Restart, false, false, at(t0, 3)),
            PowerAnswer::Limit
        );
        // per device
        assert_eq!(
            m.request(TABLET, Power::Restart, false, false, at(t0, 3)),
            PowerAnswer::Started
        );
        m.request(TABLET, Power::Cancel, false, false, at(t0, 3));
        // and again after a minute
        assert_eq!(
            m.request(PHONE, Power::Restart, false, false, at(t0, 61)),
            PowerAnswer::Started
        );
    }

    #[test]
    fn a_busy_pc_is_said_first_and_despite_starts_anyway() {
        let t0 = Instant::now();
        let mut m = Machine::default();
        assert_eq!(
            m.request(PHONE, Power::ShutDown, false, true, t0),
            PowerAnswer::Working
        );
        assert!(m.running(t0).is_none(), "nothing started");
        assert_eq!(
            m.request(PHONE, Power::ShutDown, true, true, t0),
            PowerAnswer::Started
        );
    }

    #[test]
    fn stopped_at_the_pc_the_device_is_quiet_and_the_second_time_loses_power() {
        let t0 = Instant::now();
        let mut m = Machine::default();
        m.request(PHONE, Power::ShutDown, false, false, t0);
        assert_eq!(m.cancel_at_pc(at(t0, 2)), Some((PHONE, false)));
        // ten minutes without a new window from that device; another device is not affected
        assert_eq!(
            m.request(PHONE, Power::ShutDown, false, false, at(t0, 120)),
            PowerAnswer::Limit
        );
        assert_eq!(
            m.request(TABLET, Power::Sleep, false, false, at(t0, 120)),
            PowerAnswer::Started
        );
        m.request(TABLET, Power::Cancel, false, false, at(t0, 120));
        assert_eq!(
            m.request(PHONE, Power::ShutDown, false, false, at(t0, 603)),
            PowerAnswer::Started
        );
        // the second stop at the PC within the hour takes the permission away
        assert_eq!(m.cancel_at_pc(at(t0, 605)), Some((PHONE, true)));
        // nothing running: nothing to stop
        assert_eq!(m.cancel_at_pc(at(t0, 606)), None);
        // a cancel from the phone is no stop at the PC
        let mut m = Machine::default();
        m.request(PHONE, Power::Sleep, false, false, t0);
        m.request(PHONE, Power::Cancel, false, false, t0);
        assert_eq!(
            m.request(PHONE, Power::Sleep, false, false, at(t0, 1)),
            PowerAnswer::Started
        );
    }

    #[test]
    fn the_countdown_sentence_names_who_and_what() {
        use crate::texts::{power_countdown, Lang};
        assert_eq!(
            power_countdown(Lang::De, "Svens Handy", Act::ShutDown, 10),
            "Svens Handy schaltet diesen PC in 10 Sekunden aus."
        );
        assert_eq!(
            power_countdown(Lang::De, "Svens Handy", Act::Restart, 1),
            "Svens Handy startet diesen PC in 1 Sekunde neu."
        );
        assert_eq!(
            power_countdown(Lang::En, "Sven's phone", Act::Sleep, 3),
            "Sven's phone will put this PC to sleep in 3 seconds."
        );
        for act in [
            Act::Sleep,
            Act::Hibernate,
            Act::SignOut,
            Act::Restart,
            Act::ShutDown,
        ] {
            for lang in [Lang::De, Lang::En] {
                let text = power_countdown(lang, "X", act, 5);
                assert!(text.starts_with("X ") && text.contains('5'), "{text}");
            }
        }
    }

    #[test]
    fn a_page_that_stops_asking_stops_the_countdown() {
        let t0 = Instant::now();
        let mut m = Machine::default();
        m.request(PHONE, Power::ShutDown, false, false, t0);
        assert_eq!(look(&mut m, at(t0, 1), YES, false, true), Tick::Nothing);
        // still on screen, but the page went quiet
        assert_eq!(m.tick(at(t0, 3), YES, false, true), Tick::Stopped);
        assert!(m.running(at(t0, 3)).is_none());
    }

    #[test]
    fn news_numbers_grow() {
        let t0 = Instant::now();
        let mut m = Machine::default();
        assert_eq!(m.news(), None);
        m.request(PHONE, Power::Sleep, false, false, t0);
        m.request(PHONE, Power::Cancel, false, false, t0);
        let (a, _, _) = m.news().unwrap();
        m.request(PHONE, Power::Sleep, false, false, at(t0, 1));
        m.cancel_at_pc(at(t0, 1));
        let (b, _, _) = m.news().unwrap();
        assert!(b > a);
        // a cancel with nothing running is no news
        m.request(PHONE, Power::Cancel, false, false, at(t0, 2));
        assert_eq!(m.news().unwrap().0, b);
    }
}
