//! The catalogue of Windows settings the page can switch ("Einstellungen").
//!
//! A setting is admitted only when all of this holds (`docs/design/disk-deep/TWEAKS.md`):
//! - Windows offers it itself in Settings or the Control Panel, per user;
//! - the mechanism is documented by Microsoft (an API, or a registry value named in a Microsoft
//!   article) and the entry carries that URL;
//! - it needs no administrator rights and is fully taken back by restoring the state from before.
//!
//! Three mechanisms, nothing else:
//! - a `REG_DWORD` below `HKCU\Software` through the [`Registry`] seam (never a `Policies` key);
//! - a documented on/off API of Windows ([`Flag`]: `SystemParametersInfo`, `SHGetSetSettings`);
//! - the active power plan, chosen among the plans that exist on the machine.
//!
//! Every change goes through [`Journal::change`], so the state from before is on disk first.

use crate::journal::{apply_undo, ChangeError, Journal, JournalError, Kind, Undo};
use crate::reg::{RegError, Registry, Value};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Risk {
    /// Changes what is shown, nothing else.
    None,
    /// Has a side effect the user should know (battery life, hidden files become clickable).
    Low,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Group {
    Appearance,
    Explorer,
    Privacy,
    Power,
}

/// When the user sees the change.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Refresh {
    /// At once.
    None,
    /// Explorer windows that are already open show it after a refresh (F5).
    Explorer,
}

/// An on/off state Windows exposes through a documented API (not a registry value of ours).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Flag {
    /// `SystemParametersInfo` `SPI_GETCLIENTAREAANIMATION` / `SPI_SETCLIENTAREAANIMATION`.
    ClientAreaAnimation,
    /// `SystemParametersInfo` `SPI_GETDRAGFULLWINDOWS` / `SPI_SETDRAGFULLWINDOWS`.
    DragFullWindows,
    /// `SystemParametersInfo` `SPI_GETMOUSESONAR` / `SPI_SETMOUSESONAR`.
    MouseSonar,
    /// `SHGetSetSettings` `SSF_SHOWEXTENSIONS`.
    ShowExtensions,
    /// `SHGetSetSettings` `SSF_SHOWALLOBJECTS`.
    ShowHiddenFiles,
}

impl Flag {
    pub const ALL: [Flag; 5] = [
        Flag::ClientAreaAnimation,
        Flag::DragFullWindows,
        Flag::MouseSonar,
        Flag::ShowExtensions,
        Flag::ShowHiddenFiles,
    ];

    /// The name in the journal (`Undo::Other::what`). Never change one: old journals hold them.
    pub fn code(self) -> &'static str {
        match self {
            Flag::ClientAreaAnimation => "spi:clientAreaAnimation",
            Flag::DragFullWindows => "spi:dragFullWindows",
            Flag::MouseSonar => "spi:mouseSonar",
            Flag::ShowExtensions => "shell:showExtensions",
            Flag::ShowHiddenFiles => "shell:showAllObjects",
        }
    }

    pub fn from_code(code: &str) -> Option<Flag> {
        Flag::ALL.into_iter().find(|f| f.code() == code)
    }
}

/// `Undo::Other::what` of the active power plan; `previous` is the plan's GUID.
pub const POWER_SCHEME: &str = "powerScheme";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mechanism {
    /// A `REG_DWORD` of the current user. `default_when_missing`: what Windows does while the
    /// value does not exist (`None` = not documented, shown as "Standard von Windows").
    Reg {
        key: &'static str,
        name: &'static str,
        on: u32,
        off: u32,
        default_when_missing: Option<bool>,
    },
    Flag(Flag),
    /// The active power plan: a choice among the existing plans, never a new or imported one.
    PowerScheme,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Tweak {
    /// Stable: the journal and the texts of the page are keyed by it.
    pub id: &'static str,
    pub group: Group,
    pub mechanism: Mechanism,
    /// The Microsoft page that documents the mechanism.
    pub source_url: &'static str,
    pub risk: Risk,
    /// First Windows build that has the setting (0 = every supported Windows).
    pub min_build: u32,
    pub refresh: Refresh,
}

const SPI_DOC: &str =
    "https://learn.microsoft.com/windows/win32/api/winuser/nf-winuser-systemparametersinfow";
const SHELL_DOC: &str =
    "https://learn.microsoft.com/windows/win32/api/shlobj_core/nf-shlobj_core-shgetsetsettings";
const PRIVACY_DOC: &str = "https://learn.microsoft.com/windows/privacy/manage-connections-from-windows-operating-system-components-to-microsoft-services";
const POWER_DOC: &str =
    "https://learn.microsoft.com/windows/win32/api/powersetting/nf-powersetting-powersetactivescheme";

const CATALOGUE: [Tweak; 8] = [
    Tweak {
        id: "animations",
        group: Group::Appearance,
        mechanism: Mechanism::Flag(Flag::ClientAreaAnimation),
        source_url: SPI_DOC,
        risk: Risk::None,
        min_build: 0,
        refresh: Refresh::None,
    },
    Tweak {
        id: "dragFullWindows",
        group: Group::Appearance,
        mechanism: Mechanism::Flag(Flag::DragFullWindows),
        source_url: SPI_DOC,
        risk: Risk::None,
        min_build: 0,
        refresh: Refresh::None,
    },
    Tweak {
        id: "pointerSonar",
        group: Group::Appearance,
        mechanism: Mechanism::Flag(Flag::MouseSonar),
        source_url: SPI_DOC,
        risk: Risk::None,
        min_build: 0,
        refresh: Refresh::None,
    },
    Tweak {
        id: "fileExtensions",
        group: Group::Explorer,
        mechanism: Mechanism::Flag(Flag::ShowExtensions),
        source_url: SHELL_DOC,
        risk: Risk::None,
        min_build: 0,
        refresh: Refresh::Explorer,
    },
    Tweak {
        id: "hiddenFiles",
        group: Group::Explorer,
        mechanism: Mechanism::Flag(Flag::ShowHiddenFiles),
        source_url: SHELL_DOC,
        risk: Risk::Low,
        min_build: 0,
        refresh: Refresh::Explorer,
    },
    Tweak {
        id: "advertisingId",
        group: Group::Privacy,
        mechanism: Mechanism::Reg {
            key: r"Software\Microsoft\Windows\CurrentVersion\AdvertisingInfo",
            name: "Enabled",
            on: 1,
            off: 0,
            default_when_missing: None,
        },
        source_url: PRIVACY_DOC,
        risk: Risk::None,
        min_build: 0,
        refresh: Refresh::None,
    },
    Tweak {
        id: "trackAppLaunches",
        group: Group::Privacy,
        mechanism: Mechanism::Reg {
            key: r"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced",
            name: "Start_TrackProgs",
            on: 1,
            off: 0,
            default_when_missing: None,
        },
        source_url: PRIVACY_DOC,
        risk: Risk::Low,
        // The switch came with Windows 10 1703.
        min_build: 15063,
        refresh: Refresh::None,
    },
    Tweak {
        id: "powerPlan",
        group: Group::Power,
        mechanism: Mechanism::PowerScheme,
        source_url: POWER_DOC,
        risk: Risk::Low,
        min_build: 0,
        refresh: Refresh::None,
    },
];

pub fn catalogue() -> &'static [Tweak] {
    &CATALOGUE
}

/// A power plan of this machine. `id` is its GUID in lower case.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct PowerScheme {
    pub id: String,
    /// The name Windows shows for it.
    pub label: String,
}

/// What is not a registry value of ours: Windows' own on/off APIs and the power plans.
pub trait Effects: Send + Sync {
    /// `None` when Windows does not answer.
    fn flag(&self, flag: Flag) -> Option<bool>;
    /// Persists the state for the user and tells running programs (what Windows' own pages do).
    fn set_flag(&self, flag: Flag, on: bool) -> Result<(), RegError>;
    /// The plans that exist on this machine (never created, imported or unhidden here).
    fn power_schemes(&self) -> Vec<PowerScheme>;
    fn active_power_scheme(&self) -> Option<String>;
    fn set_power_scheme(&self, id: &str) -> Result<(), RegError>;
}

/// The parts of a GUID written `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (hex, any case).
pub fn parse_guid(s: &str) -> Option<(u32, u16, u16, [u8; 8])> {
    let b = s.as_bytes();
    if b.len() != 36 {
        return None;
    }
    for (i, c) in b.iter().enumerate() {
        let dash = matches!(i, 8 | 13 | 18 | 23);
        if dash != (*c == b'-') || (!dash && !c.is_ascii_hexdigit()) {
            return None;
        }
    }
    let hex = |from: usize, to: usize| u64::from_str_radix(&s[from..to], 16).ok();
    let mut d4 = [0u8; 8];
    let tail = [19, 21, 24, 26, 28, 30, 32, 34];
    for (slot, at) in d4.iter_mut().zip(tail) {
        *slot = hex(at, at + 2)? as u8;
    }
    Some((
        hex(0, 8)? as u32,
        hex(9, 13)? as u16,
        hex(14, 18)? as u16,
        d4,
    ))
}

/// The lower-case text form of a GUID (the inverse of [`parse_guid`]).
pub fn format_guid(d1: u32, d2: u16, d3: u16, d4: [u8; 8]) -> String {
    format!(
        "{d1:08x}-{d2:04x}-{d3:04x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        d4[0], d4[1], d4[2], d4[3], d4[4], d4[5], d4[6], d4[7]
    )
}

/// In-memory effects for tests: flags start as given, power plans as seeded.
#[derive(Default)]
pub struct MemEffects {
    flags: Mutex<Vec<(Flag, bool)>>,
    schemes: Mutex<Vec<PowerScheme>>,
    active: Mutex<Option<String>>,
    /// Makes every change fail.
    pub fail_writes: std::sync::atomic::AtomicBool,
}

impl MemEffects {
    pub fn new() -> MemEffects {
        MemEffects::default()
    }

    /// Test set-up: the state of a flag (a flag that was never seeded cannot be read).
    pub fn seed_flag(&self, flag: Flag, on: bool) {
        let mut flags = self.flags.lock().unwrap_or_else(|e| e.into_inner());
        flags.retain(|(f, _)| *f != flag);
        flags.push((flag, on));
    }

    /// Test set-up: the plans of the machine; the first one is active.
    pub fn seed_schemes(&self, schemes: &[(&str, &str)]) {
        *self.schemes.lock().unwrap_or_else(|e| e.into_inner()) = schemes
            .iter()
            .map(|(id, label)| PowerScheme {
                id: id.to_string(),
                label: label.to_string(),
            })
            .collect();
        *self.active.lock().unwrap_or_else(|e| e.into_inner()) =
            schemes.first().map(|(id, _)| id.to_string());
    }

    fn failing(&self) -> bool {
        self.fail_writes.load(std::sync::atomic::Ordering::Relaxed)
    }
}

impl Effects for MemEffects {
    fn flag(&self, flag: Flag) -> Option<bool> {
        self.flags
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .iter()
            .find(|(f, _)| *f == flag)
            .map(|(_, on)| *on)
    }

    fn set_flag(&self, flag: Flag, on: bool) -> Result<(), RegError> {
        if self.failing() {
            return Err(RegError::Failed);
        }
        self.seed_flag(flag, on);
        Ok(())
    }

    fn power_schemes(&self) -> Vec<PowerScheme> {
        self.schemes
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
    }

    fn active_power_scheme(&self) -> Option<String> {
        self.active
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
    }

    fn set_power_scheme(&self, id: &str) -> Result<(), RegError> {
        if self.failing() || !self.power_schemes().iter().any(|s| s.id == id) {
            return Err(RegError::Failed);
        }
        *self.active.lock().unwrap_or_else(|e| e.into_inner()) = Some(id.to_string());
        Ok(())
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum TweakKind {
    Toggle,
    Choice,
}

/// What the page shows for one setting. Holds no registry value, only on/off or the plan.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TweakState {
    pub id: &'static str,
    pub group: Group,
    pub kind: TweakKind,
    /// A switch: its state; `None` = Windows' own default applies and is not documented, or the
    /// stored value is not one of the two this catalogue knows.
    pub on: Option<bool>,
    /// A choice: the id of the active option.
    pub choice: Option<String>,
    pub options: Vec<PowerScheme>,
    /// A state from before a change made here is stored ("Alle zurücksetzen" would touch it).
    pub changed_here: bool,
    /// The setting exists on this Windows; the page hides the others.
    pub applicable: bool,
    /// The stored value could be read exactly. When not, the page shows the setting as not
    /// changeable here: without the value from before there is no way back, so nothing is set.
    pub readable: bool,
    /// A value is stored that is neither this catalogue's "on" nor its "off" (set by another
    /// program or by hand): `on` is `None`, and the page must not call it Windows' default.
    pub custom: bool,
    pub risk: Risk,
    pub source_url: &'static str,
    pub refresh: Refresh,
}

/// What a setting is switched to.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(untagged)]
pub enum Target {
    Switch(bool),
    Choice(String),
}

#[derive(Debug, PartialEq, Eq)]
pub enum TweakError {
    UnknownTweak,
    /// The setting does not exist on this Windows.
    NotApplicable,
    /// A switch got a choice, a choice got a switch, or the plan does not exist on this machine.
    BadTarget,
    Journal(JournalError),
    Failed(RegError),
}

impl TweakError {
    pub fn code(&self) -> &'static str {
        match self {
            TweakError::UnknownTweak => "unknown-tweak",
            TweakError::NotApplicable => "not-applicable",
            TweakError::BadTarget => "bad-target",
            TweakError::Journal(e) => e.code(),
            TweakError::Failed(e) => e.code(),
        }
    }
}

/// The Windows build (`CurrentBuildNumber`); 0 when it cannot be read, which hides every setting
/// that needs a minimum build.
fn windows_build(reg: &dyn Registry) -> u32 {
    reg.machine_get(
        r"SOFTWARE\Microsoft\Windows NT\CurrentVersion",
        "CurrentBuildNumber",
    )
    .ok()
    .flatten()
    .and_then(|v| v.as_str().and_then(|s| s.trim().parse().ok()))
    .unwrap_or(0)
}

fn reg_state(value: Option<&Value>, on: u32, off: u32, missing: Option<bool>) -> Option<bool> {
    match value {
        None => missing,
        Some(v) => match v.as_dword() {
            Some(n) if n == on => Some(true),
            Some(n) if n == off => Some(false),
            _ => None,
        },
    }
}

fn state_of(
    t: &Tweak,
    build: u32,
    changed: &[String],
    reg: &dyn Registry,
    effects: &dyn Effects,
) -> TweakState {
    let mut s = TweakState {
        id: t.id,
        group: t.group,
        kind: TweakKind::Toggle,
        on: None,
        choice: None,
        options: Vec::new(),
        changed_here: changed.iter().any(|c| c == t.id),
        applicable: build >= t.min_build,
        readable: true,
        custom: false,
        risk: t.risk,
        source_url: t.source_url,
        refresh: t.refresh,
    };
    match t.mechanism {
        Mechanism::Reg {
            key,
            name,
            on,
            off,
            default_when_missing,
        } => {
            match reg.get(key, name) {
                Ok(value) => {
                    s.on = reg_state(value.as_ref(), on, off, default_when_missing);
                    s.custom = value.is_some() && s.on.is_none();
                }
                // Exists but cannot be read exactly: never guessed, never changed.
                Err(_) => s.readable = false,
            }
        }
        Mechanism::Flag(flag) => {
            s.on = effects.flag(flag);
            s.applicable &= s.on.is_some();
        }
        Mechanism::PowerScheme => {
            s.kind = TweakKind::Choice;
            s.options = effects.power_schemes();
            s.choice = effects
                .active_power_scheme()
                .filter(|a| s.options.iter().any(|o| o.id == *a));
            // One plan only (most laptops with modern standby): there is nothing to choose.
            s.applicable &= s.options.len() >= 2 && s.choice.is_some();
        }
    }
    s
}

/// The state of every catalogue entry, in catalogue order.
pub fn state(journal: &Journal, reg: &dyn Registry, effects: &dyn Effects) -> Vec<TweakState> {
    let build = windows_build(reg);
    let changed: Vec<String> = journal
        .originals(Kind::Tweak)
        .into_iter()
        .map(|(subject, _)| subject)
        .collect();
    CATALOGUE
        .iter()
        .map(|t| state_of(t, build, &changed, reg, effects))
        .collect()
}

fn on_off(on: bool) -> &'static str {
    if on {
        "on"
    } else {
        "off"
    }
}

/// Switches a setting. The state from before is saved first; a setting that already has the
/// wanted state is left alone (`Ok(None)`, no journal entry).
pub fn set(
    journal: &mut Journal,
    reg: &dyn Registry,
    effects: &dyn Effects,
    id: &str,
    target: &Target,
    now: i64,
) -> Result<Option<u64>, TweakError> {
    let t = CATALOGUE
        .iter()
        .find(|t| t.id == id)
        .ok_or(TweakError::UnknownTweak)?;
    let current = state_of(t, windows_build(reg), &[], reg, effects);
    if !current.applicable {
        return Err(TweakError::NotApplicable);
    }
    let map = |e: ChangeError<RegError>| match e {
        ChangeError::Journal(e) => TweakError::Journal(e),
        ChangeError::Apply(e) => TweakError::Failed(e),
    };
    match (t.mechanism, target) {
        (
            Mechanism::Reg {
                key, name, on, off, ..
            },
            Target::Switch(want),
        ) => {
            // The raw value, whatever its type: an undo puts back exactly this. A value that
            // cannot be read exactly has no way back, so the change is refused.
            let previous = reg.get(key, name).map_err(TweakError::Failed)?;
            // Only a value that is already the wanted number counts as "already so": a missing
            // value with a known default is still written, so the state is explicit afterwards.
            let wanted = Value::Dword(if *want { on } else { off });
            if previous.as_ref() == Some(&wanted) {
                return Ok(None);
            }
            let undo = vec![Undo::Reg {
                key: key.to_string(),
                name: name.to_string(),
                previous,
                // An undo (or reset) leaves the value alone when Windows' own settings changed
                // it after this.
                written: Some(wanted.clone()),
            }];
            journal
                .change(now, Kind::Tweak, id, "", Some(*want), undo, || {
                    reg.set(key, name, &wanted)
                })
                .map(Some)
                .map_err(map)
        }
        (Mechanism::Flag(flag), Target::Switch(want)) => {
            let previous = current.on.ok_or(TweakError::NotApplicable)?;
            if previous == *want {
                return Ok(None);
            }
            let undo = vec![Undo::Other {
                what: flag.code().to_string(),
                previous: on_off(previous).to_string(),
                written: Some(on_off(*want).to_string()),
            }];
            journal
                .change(now, Kind::Tweak, id, "", Some(*want), undo, || {
                    effects.set_flag(flag, *want)
                })
                .map(Some)
                .map_err(map)
        }
        (Mechanism::PowerScheme, Target::Choice(want)) => {
            if !current.options.iter().any(|o| o.id == *want) {
                return Err(TweakError::BadTarget);
            }
            let previous = current.choice.ok_or(TweakError::NotApplicable)?;
            if previous == *want {
                return Ok(None);
            }
            let undo = vec![Undo::Other {
                what: POWER_SCHEME.to_string(),
                previous,
                written: Some(want.clone()),
            }];
            // The plan's name goes along as the entry's label, so the history can say which.
            let label = current
                .options
                .iter()
                .find(|o| o.id == *want)
                .map(|o| o.label.clone())
                .unwrap_or_default();
            journal
                .change(now, Kind::Tweak, id, &label, None, undo, || {
                    effects.set_power_scheme(want)
                })
                .map(Some)
                .map_err(map)
        }
        _ => Err(TweakError::BadTarget),
    }
}

/// Takes back a step that is not a registry value (`Undo::Other`). Unknown names and states are
/// refused, so nothing counts as taken back that was not. When the step knows what the change
/// set (`written`) and the state is no longer that – Windows' own settings changed it since, or
/// the plan to go back to is gone – the answer is `ChangedElsewhere` and nothing is touched: the
/// newer choice stands.
pub fn apply_other(
    effects: &dyn Effects,
    what: &str,
    previous: &str,
    written: Option<&str>,
) -> Result<(), RegError> {
    if what == POWER_SCHEME {
        if written.is_some_and(|w| effects.active_power_scheme().as_deref() != Some(w)) {
            return Err(RegError::ChangedElsewhere);
        }
        // Only a plan that still exists; a removed one cannot be brought back from here.
        if !effects.power_schemes().iter().any(|s| s.id == previous) {
            return Err(RegError::ChangedElsewhere);
        }
        return effects.set_power_scheme(previous);
    }
    let flag = Flag::from_code(what).ok_or(RegError::Unsupported)?;
    let state = |text: &str| match text {
        "on" => Ok(true),
        "off" => Ok(false),
        _ => Err(RegError::Failed),
    };
    let on = state(previous)?;
    if let Some(w) = written {
        if effects.flag(flag) != Some(state(w)?) {
            return Err(RegError::ChangedElsewhere);
        }
    }
    effects.set_flag(flag, on)
}

/// The outcome of "Alle zurücksetzen": setting ids, alphabetical.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResetReport {
    pub restored: Vec<String>,
    /// Could not be put back (or not noted as put back); they stay "changed here" for a retry.
    pub failed: Vec<String>,
    /// Changed in Windows itself since: left as they are, and no longer counted as changed
    /// here (the newer choice stands).
    pub left: Vec<String>,
}

/// Puts every setting changed here back to the state from before its **first** change. Each
/// setting on its own: one that fails is reported and the others are still put back.
pub fn reset_all(journal: &mut Journal, reg: &dyn Registry, effects: &dyn Effects) -> ResetReport {
    let mut report = ResetReport::default();
    for (subject, steps) in journal.originals(Kind::Tweak) {
        let applied = apply_undo(reg, &steps, |what, previous, written| {
            apply_other(effects, what, previous, written)
        });
        match applied {
            Ok(()) if journal.mark_reset(Kind::Tweak, &subject).is_ok() => {
                report.restored.push(subject)
            }
            // Windows' own settings changed it after us: that choice stands, nothing is
            // written, and the setting stops counting as changed here.
            Err(RegError::ChangedElsewhere)
                if journal.mark_stale(Kind::Tweak, &subject).is_ok() =>
            {
                report.left.push(subject)
            }
            _ => report.failed.push(subject),
        }
    }
    report
}

/// The effects of this machine; `None` where there are none (Linux, macOS).
pub fn system_effects() -> Option<Box<dyn Effects>> {
    #[cfg(windows)]
    {
        Some(Box::new(WinEffects))
    }
    #[cfg(not(windows))]
    {
        None
    }
}

/// Windows' own APIs behind [`Effects`].
#[cfg(windows)]
pub struct WinEffects;

#[cfg(windows)]
mod win {
    use super::*;
    use std::ffi::c_void;
    use windows::core::GUID;
    use windows::Win32::Foundation::{LocalFree, ERROR_SUCCESS, HLOCAL};
    use windows::Win32::System::Power::{
        PowerEnumerate, PowerGetActiveScheme, PowerReadFriendlyName, PowerSetActiveScheme,
        ACCESS_SCHEME,
    };
    use windows::Win32::UI::Shell::{
        SHGetSetSettings, SHELLSTATEA, SSF_MASK, SSF_SHOWALLOBJECTS, SSF_SHOWEXTENSIONS,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        SystemParametersInfoW, SPIF_SENDCHANGE, SPIF_UPDATEINIFILE, SPI_GETCLIENTAREAANIMATION,
        SPI_GETDRAGFULLWINDOWS, SPI_GETMOUSESONAR, SPI_SETCLIENTAREAANIMATION,
        SPI_SETDRAGFULLWINDOWS, SPI_SETMOUSESONAR, SYSTEM_PARAMETERS_INFO_ACTION,
    };

    /// More plans than any machine has; ends the enumeration whatever Windows answers.
    const MAX_SCHEMES: u32 = 64;

    /// Where `SystemParametersInfo` takes the new state of a parameter (per its documentation).
    enum SetVia {
        /// `uiParam` is TRUE or FALSE.
        UiParam,
        /// `pvParam` is TRUE or FALSE (the value itself, not a pointer).
        PvParam,
    }

    fn spi(
        flag: Flag,
    ) -> Option<(
        SYSTEM_PARAMETERS_INFO_ACTION,
        SYSTEM_PARAMETERS_INFO_ACTION,
        SetVia,
    )> {
        match flag {
            Flag::ClientAreaAnimation => Some((
                SPI_GETCLIENTAREAANIMATION,
                SPI_SETCLIENTAREAANIMATION,
                SetVia::PvParam,
            )),
            Flag::DragFullWindows => Some((
                SPI_GETDRAGFULLWINDOWS,
                SPI_SETDRAGFULLWINDOWS,
                SetVia::UiParam,
            )),
            Flag::MouseSonar => Some((SPI_GETMOUSESONAR, SPI_SETMOUSESONAR, SetVia::PvParam)),
            Flag::ShowExtensions | Flag::ShowHiddenFiles => None,
        }
    }

    /// The mask of a shell flag and its bit in `SHELLSTATE` (`fShowAllObjects` is the first bit
    /// field of the structure, `fShowExtensions` the second).
    fn shell(flag: Flag) -> Option<(SSF_MASK, i32)> {
        match flag {
            Flag::ShowHiddenFiles => Some((SSF_SHOWALLOBJECTS, 1 << 0)),
            Flag::ShowExtensions => Some((SSF_SHOWEXTENSIONS, 1 << 1)),
            _ => None,
        }
    }

    fn guid_text(g: &GUID) -> String {
        format_guid(g.data1, g.data2, g.data3, g.data4)
    }

    fn guid_of(text: &str) -> Option<GUID> {
        parse_guid(text).map(|(d1, d2, d3, d4)| GUID::from_values(d1, d2, d3, d4))
    }

    fn friendly_name(scheme: &GUID) -> Option<String> {
        let mut size = 0u32;
        // SAFETY: a size query without a buffer; `scheme` and `size` are valid for the call.
        unsafe {
            let _ = PowerReadFriendlyName(None, Some(scheme), None, None, None, &mut size);
        }
        if size == 0 || size > 4096 {
            return None;
        }
        let mut buf = vec![0u8; size as usize];
        // SAFETY: `buf` is `size` bytes long and outlives the call; `size` is updated by it.
        let rc = unsafe {
            PowerReadFriendlyName(
                None,
                Some(scheme),
                None,
                None,
                Some(buf.as_mut_ptr()),
                &mut size,
            )
        };
        if rc != ERROR_SUCCESS {
            return None;
        }
        let units: Vec<u16> = buf[..(size as usize).min(buf.len())]
            .chunks_exact(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .take_while(|&u| u != 0)
            .collect();
        let name = String::from_utf16_lossy(&units);
        (!name.trim().is_empty()).then_some(name)
    }

    impl Effects for WinEffects {
        fn flag(&self, flag: Flag) -> Option<bool> {
            if let Some((get, _, _)) = spi(flag) {
                let mut on = 0i32;
                // SAFETY: every "get" action used here writes one BOOL through `pvParam`; `on`
                // is a local of that size.
                let ok = unsafe {
                    SystemParametersInfoW(
                        get,
                        0,
                        Some((&mut on as *mut i32).cast::<c_void>()),
                        Default::default(),
                    )
                };
                return ok.is_ok().then_some(on != 0);
            }
            let (mask, bit) = shell(flag)?;
            let mut st = SHELLSTATEA::default();
            // SAFETY: `st` is a local SHELLSTATE; with `bSet` false the call only fills it.
            unsafe { SHGetSetSettings(Some(&mut st), mask, false) };
            let bits = st._bitfield1;
            Some(bits & bit != 0)
        }

        fn set_flag(&self, flag: Flag, on: bool) -> Result<(), RegError> {
            if let Some((_, set, via)) = spi(flag) {
                let (ui, pv) = match via {
                    SetVia::UiParam => (on as u32, None),
                    // Documented: the value itself travels in `pvParam`, it is not dereferenced.
                    SetVia::PvParam => (0, Some(on as usize as *mut c_void)),
                };
                // SAFETY: no pointer is passed that Windows would read or write; the flags ask
                // Windows to store the state for the user and to tell running programs.
                let ok = unsafe {
                    SystemParametersInfoW(set, ui, pv, SPIF_UPDATEINIFILE | SPIF_SENDCHANGE)
                };
                return ok.map_err(|_| RegError::Failed);
            }
            let (mask, bit) = shell(flag).ok_or(RegError::Unsupported)?;
            let mut st = SHELLSTATEA::default();
            if on {
                st._bitfield1 = bit;
            }
            // SAFETY: `st` is a local SHELLSTATE; with `bSet` true only the field named by
            // `mask` is taken from it.
            unsafe { SHGetSetSettings(Some(&mut st), mask, true) };
            // The call reports nothing: read the state back to know whether it took. If not,
            // the old state is set once more, so a failed change leaves nothing half done.
            if self.flag(flag) == Some(on) {
                Ok(())
            } else {
                st._bitfield1 = if on { 0 } else { bit };
                // SAFETY: as above.
                unsafe { SHGetSetSettings(Some(&mut st), mask, true) };
                Err(RegError::Failed)
            }
        }

        fn power_schemes(&self) -> Vec<PowerScheme> {
            let mut out = Vec::new();
            for index in 0..MAX_SCHEMES {
                let mut guid = GUID::zeroed();
                let mut size = std::mem::size_of::<GUID>() as u32;
                // SAFETY: the buffer is one local GUID and `size` says so.
                let rc = unsafe {
                    PowerEnumerate(
                        None,
                        None,
                        None,
                        ACCESS_SCHEME,
                        index,
                        Some((&mut guid as *mut GUID).cast::<u8>()),
                        &mut size,
                    )
                };
                if rc != ERROR_SUCCESS {
                    break;
                }
                // A plan Windows gives no name for is not offered.
                if let Some(label) = friendly_name(&guid) {
                    out.push(PowerScheme {
                        id: guid_text(&guid),
                        label,
                    });
                }
            }
            out
        }

        fn active_power_scheme(&self) -> Option<String> {
            let mut ptr: *mut GUID = std::ptr::null_mut();
            // SAFETY: Windows allocates the GUID and hands it out through `ptr`; it is copied
            // and freed with LocalFree right below, as documented.
            unsafe {
                if PowerGetActiveScheme(None, &mut ptr) != ERROR_SUCCESS || ptr.is_null() {
                    return None;
                }
                let guid = *ptr;
                let _ = LocalFree(Some(HLOCAL(ptr.cast())));
                Some(guid_text(&guid))
            }
        }

        fn set_power_scheme(&self, id: &str) -> Result<(), RegError> {
            let guid = guid_of(id).ok_or(RegError::Failed)?;
            // Only a plan this machine lists: nothing hidden is ever activated.
            if !self.power_schemes().iter().any(|s| s.id == id) {
                return Err(RegError::Failed);
            }
            // SAFETY: `guid` is a local that outlives the call.
            let rc = unsafe { PowerSetActiveScheme(None, Some(&guid)) };
            if rc == ERROR_SUCCESS {
                Ok(())
            } else {
                Err(RegError::Failed)
            }
        }
    }

    /// Read-only checks against the real machine (the Windows CI job runs them). Nothing here
    /// changes a setting.
    #[cfg(test)]
    mod tests {
        use super::*;
        use crate::reg::WinRegistry;

        #[test]
        fn the_system_parameters_can_be_read() {
            let e = WinEffects;
            for f in [
                Flag::ClientAreaAnimation,
                Flag::DragFullWindows,
                Flag::MouseSonar,
            ] {
                assert!(e.flag(f).is_some(), "{}", f.code());
            }
        }

        /// Pins the bit positions in `SHELLSTATE`: what the shell API reports must be what
        /// Explorer stores for the same two options (where it stores them at all).
        #[test]
        fn the_shell_flags_agree_with_what_explorer_stores() {
            let e = WinEffects;
            let r = WinRegistry;
            let key = r"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced";
            let dword = |name: &str| r.get(key, name).ok().flatten().and_then(|v| v.as_dword());
            if let Some(n) = dword("HideFileExt") {
                assert_eq!(e.flag(Flag::ShowExtensions), Some(n == 0));
            }
            if let Some(n) = dword("Hidden") {
                assert_eq!(e.flag(Flag::ShowHiddenFiles), Some(n == 1));
            }
            assert!(e.flag(Flag::ShowExtensions).is_some());
        }

        #[test]
        fn the_active_power_plan_is_one_of_the_listed_ones() {
            let e = WinEffects;
            let plans = e.power_schemes();
            assert!(!plans.is_empty());
            let active = e.active_power_scheme().expect("an active plan");
            assert!(parse_guid(&active).is_some(), "{active}");
            assert!(plans.iter().any(|p| p.id == active), "{active}");
            assert!(plans.iter().all(|p| !p.label.is_empty()));
        }

        #[test]
        fn a_plan_that_is_not_listed_is_refused() {
            let e = WinEffects;
            assert_eq!(
                e.set_power_scheme("00000000-0000-0000-0000-000000000001"),
                Err(RegError::Failed)
            );
            assert_eq!(e.set_power_scheme("not a guid"), Err(RegError::Failed));
        }

        #[test]
        fn the_catalogue_reads_on_a_real_machine() {
            let path = std::env::temp_dir()
                .join(format!("tm-pc-tune-tweaks-{}", std::process::id()))
                .join("journal.json");
            let (j, _) = Journal::open(&path).unwrap();
            let states = state(&j, &WinRegistry, &WinEffects);
            assert_eq!(states.len(), catalogue().len());
            assert!(states.iter().all(|s| !s.changed_here));
            assert!(states.iter().any(|s| s.applicable));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::journal::MAX_ENTRIES;
    use crate::reg::{valid_key, MemRegistry};
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicU64, Ordering};

    const BALANCED: &str = "381b4222-f694-41f0-9685-ff5bb260df2e";
    const SAVER: &str = "a1841308-3541-4fab-bc81-f71556f20b4a";
    const AD_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\AdvertisingInfo";
    const ADV_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced";

    fn temp_path(tag: &str) -> PathBuf {
        static N: AtomicU64 = AtomicU64::new(0);
        std::env::temp_dir()
            .join(format!(
                "tm-pc-tune-tw-{tag}-{}-{}",
                std::process::id(),
                N.fetch_add(1, Ordering::Relaxed)
            ))
            .join("journal.json")
    }

    fn cleanup(path: &Path) {
        if let Some(dir) = path.parent() {
            let _ = std::fs::remove_dir_all(dir);
        }
    }

    /// A Windows 11 machine with two power plans and every flag readable.
    fn machine() -> (MemRegistry, MemEffects) {
        let reg = MemRegistry::new();
        reg.seed_machine(
            r"SOFTWARE\Microsoft\Windows NT\CurrentVersion",
            "CurrentBuildNumber",
            Value::Sz("22631".into()),
        );
        let fx = MemEffects::new();
        fx.seed_flag(Flag::ClientAreaAnimation, true);
        fx.seed_flag(Flag::DragFullWindows, true);
        fx.seed_flag(Flag::MouseSonar, false);
        fx.seed_flag(Flag::ShowExtensions, false);
        fx.seed_flag(Flag::ShowHiddenFiles, false);
        fx.seed_schemes(&[(BALANCED, "Ausbalanciert"), (SAVER, "Energiesparmodus")]);
        (reg, fx)
    }

    fn of<'a>(states: &'a [TweakState], id: &str) -> &'a TweakState {
        states.iter().find(|s| s.id == id).expect(id)
    }

    fn undo(j: &mut Journal, reg: &MemRegistry, fx: &MemEffects, id: u64) {
        let steps = j.undo_steps(id).unwrap();
        apply_undo(reg, &steps, |w, p, wr| apply_other(fx, w, p, wr)).unwrap();
        j.mark_undone(id).unwrap();
    }

    #[test]
    fn every_entry_has_a_microsoft_source_a_low_risk_and_a_stable_unique_id() {
        let ids: Vec<&str> = catalogue().iter().map(|t| t.id).collect();
        // Pinned on purpose: an id is the key of journal entries and of the page's texts.
        assert_eq!(
            ids,
            [
                "animations",
                "dragFullWindows",
                "pointerSonar",
                "fileExtensions",
                "hiddenFiles",
                "advertisingId",
                "trackAppLaunches",
                "powerPlan",
            ]
        );
        for t in catalogue() {
            assert!(
                t.source_url.starts_with("https://learn.microsoft.com/")
                    || t.source_url.starts_with("https://support.microsoft.com/"),
                "{}",
                t.id
            );
            assert!(t.source_url.len() > "https://learn.microsoft.com/".len());
            assert!(!t.source_url.contains(char::is_whitespace));
            assert!(t.risk <= Risk::Low, "{}", t.id);
            assert!(t.id.chars().all(|c| c.is_ascii_alphanumeric()), "{}", t.id);
        }
    }

    #[test]
    fn registry_entries_stay_below_the_users_software_key_and_never_touch_a_policy() {
        let mut seen = 0;
        for t in catalogue() {
            if let Mechanism::Reg {
                key, name, on, off, ..
            } = t.mechanism
            {
                seen += 1;
                assert!(valid_key(key), "{key}");
                // `valid_key` refuses everything outside `Software\…` and every `Policies` key.
                assert!(key.starts_with(r"Software\"), "{key}");
                assert!(!key.to_ascii_lowercase().contains("policies"), "{key}");
                assert!(!valid_key(&format!(r"{key}\Policies")));
                assert!(!key.to_ascii_lowercase().starts_with("hk"), "{key}");
                assert!(!name.is_empty() && !name.contains('\\'), "{name}");
                assert_ne!(on, off, "{}", t.id);
            }
        }
        assert!(seen > 0);
    }

    #[test]
    fn flag_codes_round_trip_and_are_pinned() {
        for f in Flag::ALL {
            assert_eq!(Flag::from_code(f.code()), Some(f));
        }
        assert_eq!(
            Flag::ClientAreaAnimation.code(),
            "spi:clientAreaAnimation",
            "old journals hold this name"
        );
        assert_eq!(Flag::from_code(""), None);
        assert_eq!(Flag::from_code(POWER_SCHEME), None);
    }

    #[test]
    fn the_state_shows_what_is_set_and_admits_what_it_does_not_know() {
        let path = temp_path("state");
        let (reg, fx) = machine();
        let (j, _) = Journal::open(&path).unwrap();
        let s = state(&j, &reg, &fx);
        assert_eq!(s.len(), catalogue().len());
        assert!(s.iter().all(|x| x.applicable && !x.changed_here));
        assert_eq!(of(&s, "animations").on, Some(true));
        assert_eq!(of(&s, "pointerSonar").on, Some(false));
        // No value yet and no documented default: the page says "Standard von Windows".
        assert_eq!(of(&s, "advertisingId").on, None);
        let plan = of(&s, "powerPlan");
        assert_eq!(plan.kind, TweakKind::Choice);
        assert_eq!(plan.choice.as_deref(), Some(BALANCED));
        assert_eq!(plan.options.len(), 2);

        reg.set(AD_KEY, "Enabled", &Value::Dword(0)).unwrap();
        assert_eq!(of(&state(&j, &reg, &fx), "advertisingId").on, Some(false));
        reg.set(AD_KEY, "Enabled", &Value::Dword(1)).unwrap();
        assert_eq!(of(&state(&j, &reg, &fx), "advertisingId").on, Some(true));
        // Neither of the two known numbers, or another type: unknown, never guessed.
        reg.set(AD_KEY, "Enabled", &Value::Dword(7)).unwrap();
        assert_eq!(of(&state(&j, &reg, &fx), "advertisingId").on, None);
        reg.set(AD_KEY, "Enabled", &Value::Sz("1".into())).unwrap();
        assert_eq!(of(&state(&j, &reg, &fx), "advertisingId").on, None);
        cleanup(&path);
    }

    #[test]
    fn what_does_not_exist_on_this_windows_is_not_applicable_and_cannot_be_set() {
        let path = temp_path("applicable");
        let (_, fx) = machine();
        // An old build, a flag Windows does not answer for, a single power plan.
        let reg = MemRegistry::new();
        reg.seed_machine(
            r"SOFTWARE\Microsoft\Windows NT\CurrentVersion",
            "CurrentBuildNumber",
            Value::Sz("14393".into()),
        );
        let lone = MemEffects::new();
        lone.seed_schemes(&[(BALANCED, "Ausbalanciert")]);
        let (mut j, _) = Journal::open(&path).unwrap();
        let s = state(&j, &reg, &lone);
        assert!(!of(&s, "trackAppLaunches").applicable);
        assert!(!of(&s, "animations").applicable);
        assert!(!of(&s, "powerPlan").applicable);
        assert!(of(&s, "advertisingId").applicable);
        for (id, target) in [
            ("trackAppLaunches", Target::Switch(false)),
            ("animations", Target::Switch(false)),
            ("powerPlan", Target::Choice(BALANCED.into())),
        ] {
            assert_eq!(
                set(&mut j, &reg, &lone, id, &target, 1),
                Err(TweakError::NotApplicable),
                "{id}"
            );
        }
        // Without a readable build number nothing with a minimum build is offered.
        let blind = MemRegistry::new();
        assert!(!of(&state(&j, &blind, &fx), "trackAppLaunches").applicable);
        assert_eq!(blind.user_len() + reg.user_len(), 0);
        assert!(j.views().is_empty());
        cleanup(&path);
    }

    #[test]
    fn a_registry_setting_is_switched_and_undo_removes_the_value_that_was_missing() {
        let path = temp_path("reg-missing");
        let (reg, fx) = machine();
        let (mut j, _) = Journal::open(&path).unwrap();
        let id = set(
            &mut j,
            &reg,
            &fx,
            "advertisingId",
            &Target::Switch(false),
            5,
        )
        .unwrap()
        .expect("an entry");
        assert_eq!(reg.get(AD_KEY, "Enabled").unwrap(), Some(Value::Dword(0)));
        let s = state(&j, &reg, &fx);
        assert_eq!(of(&s, "advertisingId").on, Some(false));
        assert!(of(&s, "advertisingId").changed_here);
        assert!(!of(&s, "trackAppLaunches").changed_here);
        let v = &j.views()[0];
        assert_eq!(
            (v.subject.as_str(), v.on, v.can_undo),
            ("advertisingId", Some(false), true)
        );

        undo(&mut j, &reg, &fx, id);
        assert_eq!(reg.get(AD_KEY, "Enabled").unwrap(), None);
        assert!(!of(&state(&j, &reg, &fx), "advertisingId").changed_here);
        cleanup(&path);
    }

    #[test]
    fn undo_restores_the_exact_previous_value_even_of_an_unexpected_type() {
        let path = temp_path("reg-type");
        let (reg, fx) = machine();
        let odd = Value::Sz("yes".into());
        reg.set(ADV_KEY, "Start_TrackProgs", &odd).unwrap();
        let (mut j, _) = Journal::open(&path).unwrap();
        let id = set(
            &mut j,
            &reg,
            &fx,
            "trackAppLaunches",
            &Target::Switch(false),
            5,
        )
        .unwrap()
        .unwrap();
        assert_eq!(
            reg.get(ADV_KEY, "Start_TrackProgs").unwrap(),
            Some(Value::Dword(0))
        );
        undo(&mut j, &reg, &fx, id);
        assert_eq!(reg.get(ADV_KEY, "Start_TrackProgs").unwrap(), Some(odd));
        cleanup(&path);
    }

    #[test]
    fn a_flag_and_the_power_plan_are_switched_and_taken_back() {
        let path = temp_path("other");
        let (reg, fx) = machine();
        let (mut j, _) = Journal::open(&path).unwrap();
        let a = set(&mut j, &reg, &fx, "animations", &Target::Switch(false), 5)
            .unwrap()
            .unwrap();
        assert_eq!(fx.flag(Flag::ClientAreaAnimation), Some(false));
        let p = set(
            &mut j,
            &reg,
            &fx,
            "powerPlan",
            &Target::Choice(SAVER.into()),
            6,
        )
        .unwrap()
        .unwrap();
        assert_eq!(fx.active_power_scheme().as_deref(), Some(SAVER));
        let s = state(&j, &reg, &fx);
        assert_eq!(of(&s, "animations").on, Some(false));
        assert_eq!(of(&s, "powerPlan").choice.as_deref(), Some(SAVER));
        assert!(of(&s, "powerPlan").changed_here);
        assert_eq!(j.views()[0].on, None, "a choice has no on/off");
        assert_eq!(reg.user_len(), 0, "neither is a registry value of ours");

        undo(&mut j, &reg, &fx, p);
        undo(&mut j, &reg, &fx, a);
        assert_eq!(fx.active_power_scheme().as_deref(), Some(BALANCED));
        assert_eq!(fx.flag(Flag::ClientAreaAnimation), Some(true));
        assert!(j.originals(Kind::Tweak).is_empty());
        cleanup(&path);
    }

    #[test]
    fn setting_what_is_already_so_does_nothing_and_writes_no_entry() {
        let path = temp_path("same");
        let (reg, fx) = machine();
        reg.set(AD_KEY, "Enabled", &Value::Dword(1)).unwrap();
        let (mut j, _) = Journal::open(&path).unwrap();
        for (id, target) in [
            ("advertisingId", Target::Switch(true)),
            ("animations", Target::Switch(true)),
            ("pointerSonar", Target::Switch(false)),
            ("powerPlan", Target::Choice(BALANCED.into())),
        ] {
            assert_eq!(set(&mut j, &reg, &fx, id, &target, 1), Ok(None), "{id}");
        }
        assert!(j.views().is_empty());
        assert!(j.originals(Kind::Tweak).is_empty());
        assert!(!path.exists(), "nothing was saved");
        cleanup(&path);
    }

    #[test]
    fn unknown_ids_and_wrong_targets_are_refused_before_anything_happens() {
        let path = temp_path("refused");
        let (reg, fx) = machine();
        let (mut j, _) = Journal::open(&path).unwrap();
        for id in ["", "nope", "Animations", "animations ", r"Software\x"] {
            assert_eq!(
                set(&mut j, &reg, &fx, id, &Target::Switch(true), 1),
                Err(TweakError::UnknownTweak),
                "{id}"
            );
        }
        for (id, target) in [
            ("animations", Target::Choice("off".into())),
            ("advertisingId", Target::Choice("0".into())),
            ("powerPlan", Target::Switch(true)),
            // A plan this machine does not have (the hidden "Ultimate Performance").
            (
                "powerPlan",
                Target::Choice("e9a42b02-d5df-448d-aa00-03f14749eb61".into()),
            ),
            ("powerPlan", Target::Choice(String::new())),
        ] {
            assert_eq!(
                set(&mut j, &reg, &fx, id, &target, 1),
                Err(TweakError::BadTarget),
                "{id}"
            );
        }
        assert!(j.views().is_empty());
        assert_eq!(reg.user_len(), 0);
        assert_eq!(fx.active_power_scheme().as_deref(), Some(BALANCED));
        cleanup(&path);
    }

    #[test]
    fn a_failed_change_leaves_no_entry_and_no_original() {
        let path = temp_path("failed");
        let (reg, fx) = machine();
        reg.fail_writes.store(true, Ordering::Relaxed);
        fx.fail_writes.store(true, Ordering::Relaxed);
        let (mut j, _) = Journal::open(&path).unwrap();
        for (id, target) in [
            ("advertisingId", Target::Switch(false)),
            ("animations", Target::Switch(false)),
            ("powerPlan", Target::Choice(SAVER.into())),
        ] {
            assert_eq!(
                set(&mut j, &reg, &fx, id, &target, 1),
                Err(TweakError::Failed(RegError::Failed)),
                "{id}"
            );
        }
        assert!(j.views().is_empty());
        assert!(j.originals(Kind::Tweak).is_empty());
        assert!(state(&j, &reg, &fx).iter().all(|s| !s.changed_here));
        let (j, _) = Journal::open(&path).unwrap();
        assert!(j.views().is_empty());
        cleanup(&path);
    }

    #[test]
    fn nothing_is_changed_when_the_journal_cannot_be_saved() {
        let path = temp_path("unsaved");
        let blocker = path.parent().unwrap().to_path_buf();
        let (reg, fx) = machine();
        let (mut j, _) = Journal::open(&path).unwrap();
        // After opening, the journal's "folder" turns out to be a file, so saving must fail.
        std::fs::write(&blocker, b"x").unwrap();
        assert_eq!(
            set(&mut j, &reg, &fx, "animations", &Target::Switch(false), 1),
            Err(TweakError::Journal(JournalError::NotSaved))
        );
        assert_eq!(fx.flag(Flag::ClientAreaAnimation), Some(true));
        let _ = std::fs::remove_file(&blocker);
    }

    #[test]
    fn reset_all_returns_everything_to_before_the_first_change_even_with_a_full_history() {
        let path = temp_path("reset");
        let (reg, fx) = machine();
        reg.set(ADV_KEY, "Start_TrackProgs", &Value::Dword(1))
            .unwrap();
        let (mut j, _) = Journal::open(&path).unwrap();
        let mut go = |id: &str, target: Target| {
            set(&mut j, &reg, &fx, id, &target, 9).unwrap().unwrap();
        };
        go("advertisingId", Target::Switch(false));
        go("advertisingId", Target::Switch(true));
        go("advertisingId", Target::Switch(false));
        go("trackAppLaunches", Target::Switch(false));
        go("animations", Target::Switch(false));
        go("animations", Target::Switch(true));
        go("animations", Target::Switch(false));
        go("hiddenFiles", Target::Switch(true));
        go("powerPlan", Target::Choice(SAVER.into()));
        go("powerPlan", Target::Choice(BALANCED.into()));
        go("powerPlan", Target::Choice(SAVER.into()));
        // Push every one of these entries out of the capped history (an even number of
        // switches, so this setting ends where it started).
        for n in 0..MAX_ENTRIES + 2 {
            go("dragFullWindows", Target::Switch(n % 2 == 1));
        }
        assert_eq!(j.views().len(), MAX_ENTRIES);
        assert!(j.views().iter().all(|v| v.subject == "dragFullWindows"));

        // A new process still knows the values from before.
        let (mut j, _) = Journal::open(&path).unwrap();
        let mut report = reset_all(&mut j, &reg, &fx);
        report.restored.sort();
        assert_eq!(
            report.restored,
            [
                "advertisingId",
                "animations",
                "dragFullWindows",
                "hiddenFiles",
                "powerPlan",
                "trackAppLaunches"
            ]
        );
        assert!(report.failed.is_empty());
        assert_eq!(reg.get(AD_KEY, "Enabled").unwrap(), None);
        assert_eq!(
            reg.get(ADV_KEY, "Start_TrackProgs").unwrap(),
            Some(Value::Dword(1))
        );
        assert_eq!(fx.flag(Flag::ClientAreaAnimation), Some(true));
        assert_eq!(fx.flag(Flag::ShowHiddenFiles), Some(false));
        assert_eq!(fx.flag(Flag::DragFullWindows), Some(true));
        assert_eq!(fx.active_power_scheme().as_deref(), Some(BALANCED));
        assert!(j.originals(Kind::Tweak).is_empty());
        assert!(state(&j, &reg, &fx).iter().all(|s| !s.changed_here));
        // A second run has nothing left to do.
        assert_eq!(reset_all(&mut j, &reg, &fx), ResetReport::default());
        cleanup(&path);
    }

    #[test]
    fn reset_all_marks_the_open_entries_as_taken_back() {
        let path = temp_path("reset-marks");
        let (reg, fx) = machine();
        let (mut j, _) = Journal::open(&path).unwrap();
        set(
            &mut j,
            &reg,
            &fx,
            "fileExtensions",
            &Target::Switch(true),
            1,
        )
        .unwrap();
        set(
            &mut j,
            &reg,
            &fx,
            "fileExtensions",
            &Target::Switch(false),
            2,
        )
        .unwrap();
        assert_eq!(
            reset_all(&mut j, &reg, &fx).restored,
            ["fileExtensions".to_string()]
        );
        assert!(j.views().iter().all(|v| v.undone && !v.can_undo));
        assert_eq!(fx.flag(Flag::ShowExtensions), Some(false));
        cleanup(&path);
    }

    #[test]
    fn reset_all_puts_back_what_it_can_and_reports_the_rest() {
        let path = temp_path("reset-partial");
        let (reg, fx) = machine();
        let (mut j, _) = Journal::open(&path).unwrap();
        set(
            &mut j,
            &reg,
            &fx,
            "advertisingId",
            &Target::Switch(false),
            1,
        )
        .unwrap();
        set(&mut j, &reg, &fx, "animations", &Target::Switch(false), 2).unwrap();
        set(&mut j, &reg, &fx, "pointerSonar", &Target::Switch(true), 3).unwrap();
        // The registry refuses, the other mechanism still works.
        reg.fail_writes.store(true, Ordering::Relaxed);
        let report = reset_all(&mut j, &reg, &fx);
        assert_eq!(report.failed, ["advertisingId".to_string()]);
        assert_eq!(report.restored.len(), 2);
        assert_eq!(fx.flag(Flag::ClientAreaAnimation), Some(true));
        assert_eq!(fx.flag(Flag::MouseSonar), Some(false));
        let s = state(&j, &reg, &fx);
        assert!(
            of(&s, "advertisingId").changed_here,
            "still open for a retry"
        );
        assert!(!of(&s, "animations").changed_here);

        reg.fail_writes.store(false, Ordering::Relaxed);
        let report = reset_all(&mut j, &reg, &fx);
        assert_eq!(report.restored, ["advertisingId".to_string()]);
        assert_eq!(reg.get(AD_KEY, "Enabled").unwrap(), None);
        cleanup(&path);
    }

    #[test]
    fn other_steps_refuse_unknown_names_states_and_plans_that_are_gone() {
        let (_, fx) = machine();
        assert_eq!(
            apply_other(&fx, "spi:unknown", "on", None),
            Err(RegError::Unsupported)
        );
        assert_eq!(apply_other(&fx, "", "on", None), Err(RegError::Unsupported));
        assert_eq!(
            apply_other(&fx, "spi:mouseSonar", "maybe", None),
            Err(RegError::Failed)
        );
        assert_eq!(
            apply_other(
                &fx,
                POWER_SCHEME,
                "e9a42b02-d5df-448d-aa00-03f14749eb61",
                None
            ),
            Err(RegError::ChangedElsewhere)
        );
        assert_eq!(fx.flag(Flag::MouseSonar), Some(false));
        assert_eq!(fx.active_power_scheme().as_deref(), Some(BALANCED));
        apply_other(&fx, "spi:mouseSonar", "on", None).unwrap();
        apply_other(&fx, POWER_SCHEME, SAVER, None).unwrap();
        assert_eq!(fx.flag(Flag::MouseSonar), Some(true));
        assert_eq!(fx.active_power_scheme().as_deref(), Some(SAVER));
    }

    #[test]
    fn a_value_that_cannot_be_read_is_shown_as_not_changeable_and_never_written() {
        let path = temp_path("unreadable");
        let (reg, fx) = machine();
        reg.set(AD_KEY, "Enabled", &Value::Dword(1)).unwrap();
        reg.fail_reads.store(true, Ordering::Relaxed);
        let (mut j, _) = Journal::open(&path).unwrap();
        let s = state(&j, &reg, &fx);
        let ad = of(&s, "advertisingId");
        assert!(!ad.readable);
        assert_eq!(ad.on, None, "never guessed");
        // What does not go through the registry is not affected.
        assert!(of(&s, "animations").readable);
        assert_eq!(
            set(
                &mut j,
                &reg,
                &fx,
                "advertisingId",
                &Target::Switch(false),
                1
            ),
            Err(TweakError::Failed(RegError::Unreadable))
        );
        assert!(j.views().is_empty());
        assert!(j.originals(Kind::Tweak).is_empty());
        reg.fail_reads.store(false, Ordering::Relaxed);
        assert_eq!(reg.get(AD_KEY, "Enabled").unwrap(), Some(Value::Dword(1)));
        cleanup(&path);
    }

    #[test]
    fn off_on_off_then_undoing_both_leaves_nothing_for_reset_all() {
        let path = temp_path("sequence");
        let (reg, fx) = machine();
        reg.set(AD_KEY, "Enabled", &Value::Dword(0)).unwrap();
        let (mut j, _) = Journal::open(&path).unwrap();
        let go = |j: &mut Journal, on: bool| {
            set(j, &reg, &fx, "advertisingId", &Target::Switch(on), 1)
                .unwrap()
                .unwrap()
        };
        let first = go(&mut j, true);
        let second = go(&mut j, false);
        // Undoing the later change leaves the first one open: reset all still knows "off".
        undo(&mut j, &reg, &fx, second);
        assert_eq!(reg.get(AD_KEY, "Enabled").unwrap(), Some(Value::Dword(1)));
        assert!(of(&state(&j, &reg, &fx), "advertisingId").changed_here);
        undo(&mut j, &reg, &fx, first);
        assert_eq!(reg.get(AD_KEY, "Enabled").unwrap(), Some(Value::Dword(0)));
        assert!(!of(&state(&j, &reg, &fx), "advertisingId").changed_here);
        assert_eq!(reset_all(&mut j, &reg, &fx), ResetReport::default());

        // The same sequence again, but "Alle zurücksetzen" after only one undo.
        let _ = go(&mut j, true);
        let second = go(&mut j, false);
        undo(&mut j, &reg, &fx, second);
        assert_eq!(
            reset_all(&mut j, &reg, &fx).restored,
            ["advertisingId".to_string()]
        );
        assert_eq!(reg.get(AD_KEY, "Enabled").unwrap(), Some(Value::Dword(0)));
        assert!(j.views().iter().all(|v| !v.can_undo));
        cleanup(&path);
    }

    #[test]
    fn undo_and_reset_leave_alone_what_windows_changed_since() {
        let path = temp_path("elsewhere");
        let (reg, fx) = machine();
        let (mut j, _) = Journal::open(&path).unwrap();
        let id = set(
            &mut j,
            &reg,
            &fx,
            "advertisingId",
            &Target::Switch(false),
            1,
        )
        .unwrap()
        .unwrap();
        // The user switches it in Windows' own settings afterwards.
        reg.set(AD_KEY, "Enabled", &Value::Dword(1)).unwrap();
        let steps = j.undo_steps(id).unwrap();
        assert_eq!(
            apply_undo(&reg, &steps, |w, p, wr| apply_other(&fx, w, p, wr)),
            Err(RegError::ChangedElsewhere)
        );
        let report = reset_all(&mut j, &reg, &fx);
        assert_eq!(report.left, vec!["advertisingId".to_string()]);
        assert!(report.failed.is_empty() && report.restored.is_empty());
        assert_eq!(reg.get(AD_KEY, "Enabled"), Ok(Some(Value::Dword(1))));
        // Settled: no longer "changed here", the history line offers no undo.
        assert!(!of(&state(&j, &reg, &fx), "advertisingId").changed_here);
        assert!(j.views().iter().all(|v| !v.can_undo && v.stale));
        cleanup(&path);
    }

    #[test]
    fn a_plan_or_switch_changed_in_windows_since_is_left_alone() {
        const THIRD: &str = "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c";
        let path = temp_path("elsewhere-other");
        let (reg, fx) = machine();
        fx.seed_schemes(&[
            (BALANCED, "Ausbalanciert"),
            (SAVER, "Energiesparmodus"),
            (THIRD, "Höchstleistung"),
        ]);
        let (mut j, _) = Journal::open(&path).unwrap();
        // Nemo: Balanced → Saver. Then the user picks a third plan in Windows.
        let plan = set(
            &mut j,
            &reg,
            &fx,
            "powerPlan",
            &Target::Choice(SAVER.into()),
            1,
        )
        .unwrap()
        .unwrap();
        fx.set_power_scheme(THIRD).unwrap();
        let steps = j.undo_steps(plan).unwrap();
        assert_eq!(
            apply_undo(&reg, &steps, |w, p, wr| apply_other(&fx, w, p, wr)),
            Err(RegError::ChangedElsewhere)
        );
        assert_eq!(fx.active_power_scheme().as_deref(), Some(THIRD));
        // The history line names the plan Nemo chose.
        assert_eq!(j.views()[0].label, "Energiesparmodus");

        // A switch changed here twice (on → off → on), then switched off in Windows: a reset
        // would write "on" over the user's "off" – it must leave it.
        set(&mut j, &reg, &fx, "animations", &Target::Switch(false), 2).unwrap();
        set(&mut j, &reg, &fx, "animations", &Target::Switch(true), 3).unwrap();
        fx.seed_flag(Flag::ClientAreaAnimation, false);
        let report = reset_all(&mut j, &reg, &fx);
        assert!(report.restored.is_empty() && report.failed.is_empty());
        assert_eq!(
            report.left,
            vec!["animations".to_string(), "powerPlan".to_string()]
        );
        assert_eq!(fx.flag(Flag::ClientAreaAnimation), Some(false));
        assert_eq!(fx.active_power_scheme().as_deref(), Some(THIRD));
        assert!(state(&j, &reg, &fx).iter().all(|s| !s.changed_here));
        cleanup(&path);
    }

    #[test]
    fn a_stored_value_that_is_neither_on_nor_off_is_not_called_windows_default() {
        let path = temp_path("custom");
        let (reg, fx) = machine();
        let (j, _) = Journal::open(&path).unwrap();
        let missing = state(&j, &reg, &fx);
        let s = of(&missing, "advertisingId");
        assert!(s.on.is_none() && !s.custom, "no value: Windows decides");
        reg.set(AD_KEY, "Enabled", &Value::Dword(2)).unwrap();
        let odd = state(&j, &reg, &fx);
        let s = of(&odd, "advertisingId");
        assert!(s.on.is_none() && s.custom && s.readable);
        cleanup(&path);
    }

    #[test]
    fn every_registry_entry_is_on_the_list_the_real_registry_may_write() {
        for t in catalogue() {
            if let Mechanism::Reg { key, name, .. } = t.mechanism {
                assert!(crate::reg::writable(key, name), "{}: {key}", t.id);
            }
        }
    }

    #[test]
    fn guids_round_trip_and_malformed_ones_are_refused() {
        let (d1, d2, d3, d4) = parse_guid(BALANCED).unwrap();
        assert_eq!((d1, d2, d3), (0x381b_4222, 0xf694, 0x41f0));
        assert_eq!(d4, [0x96, 0x85, 0xff, 0x5b, 0xb2, 0x60, 0xdf, 0x2e]);
        assert_eq!(format_guid(d1, d2, d3, d4), BALANCED);
        let upper = BALANCED.to_uppercase();
        let (a, b, c, d) = parse_guid(&upper).unwrap();
        assert_eq!(format_guid(a, b, c, d), BALANCED);
        for bad in [
            "",
            "381b4222",
            "{381b4222-f694-41f0-9685-ff5bb260df2e}",
            "381b4222-f694-41f0-9685-ff5bb260df2",
            "381b4222-f694-41f0-9685-ff5bb260df2e0",
            "381b4222xf694-41f0-9685-ff5bb260df2e",
            "381b4222-f694-41f0-9685-ff5bb260dfzz",
            "+81b4222-f694-41f0-9685-ff5bb260df2e",
        ] {
            assert_eq!(parse_guid(bad), None, "{bad}");
        }
    }

    #[test]
    fn the_page_gets_states_but_never_a_registry_key_or_value() {
        let path = temp_path("json");
        let (reg, fx) = machine();
        reg.set(AD_KEY, "Enabled", &Value::Dword(1)).unwrap();
        let (j, _) = Journal::open(&path).unwrap();
        let json = serde_json::to_string(&state(&j, &reg, &fx)).unwrap();
        assert!(json.contains(r#""id":"advertisingId""#));
        assert!(json.contains(r#""changedHere":false"#));
        assert!(json.contains(r#""kind":"choice""#));
        assert!(json.contains(r#""risk":"low""#));
        assert!(!json.contains("Software") && !json.contains("AdvertisingInfo"));
        assert_eq!(
            serde_json::from_str::<Target>("true").unwrap(),
            Target::Switch(true)
        );
        assert_eq!(
            serde_json::from_str::<Target>(r#""x""#).unwrap(),
            Target::Choice("x".into())
        );
        assert!(serde_json::from_str::<Target>("1").is_err());
        cleanup(&path);
    }
}
