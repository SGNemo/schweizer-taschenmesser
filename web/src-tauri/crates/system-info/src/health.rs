//! Slow health facts for "Gerätestatus": how worn the battery is, and when this computer last went
//! down without shutting down (power loss, freeze, blue screen). Read on request only; nothing is
//! stored or written. What leaves this module: capacities, a cycle count, and per event a time, a
//! kind and a stop code (`0x0000009F`) – never a message text, a driver or file name, a process,
//! a user or a path from the event log.

use serde::Serialize;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatteryHealth {
    /// Capacity when new, mWh (as the battery reports it).
    pub design_mwh: u32,
    /// Capacity when fully charged today, mWh.
    pub full_mwh: u32,
    /// Charge cycles; `None` when the battery does not count them (it reports 0).
    pub cycles: Option<u32>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum CrashKind {
    /// Windows stopped with a stop code (blue screen).
    Bluescreen,
    /// Windows went down without shutting down (power loss, a freeze, the power button).
    Unexpected,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Crash {
    /// Seconds since 1970 (UTC).
    pub at_secs: i64,
    pub kind: CrashKind,
    /// Stop code of a blue screen, `0x` and eight upper-case hex digits; nothing else.
    pub code: Option<String>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Health {
    /// `None` on machines without a battery or when it cannot be read.
    pub battery: Option<BatteryHealth>,
    /// Newest first, at most `MAX_CRASHES`, from the last `CRASH_DAYS` days.
    pub crashes: Vec<Crash>,
    /// `false` when the event log could not be read (then `crashes` says nothing).
    pub crashes_read: bool,
}

pub const MAX_CRASHES: usize = 5;
pub const CRASH_DAYS: u32 = 30;
/// One crash writes several events (stop code at the next start, "unexpected shutdown", Kernel-Power 41);
/// events this close together are one crash.
const SAME_CRASH_SECS: i64 = 15 * 60;

/// A battery reading as it may be shown: both capacities known and plausible.
pub fn battery_health(design: u32, full: u32, cycles: u32) -> Option<BatteryHealth> {
    if design == 0 || full == 0 || design == u32::MAX || full == u32::MAX {
        return None;
    }
    // Some batteries report more than their design capacity when new; that is not an error.
    if full > design.saturating_mul(2) {
        return None;
    }
    Some(BatteryHealth {
        design_mwh: design,
        full_mwh: full,
        cycles: (cycles > 0 && cycles < 100_000).then_some(cycles),
    })
}

/// The stop code only: `0x`, 1–8 hex digits, as `0x%08X`. Anything else (text, parameters) gives `None`.
pub fn stop_code(raw: &str) -> Option<String> {
    let token = raw
        .split(|c: char| c.is_whitespace() || c == ',' || c == '(')
        .next()?;
    let hex = token
        .strip_prefix("0x")
        .or_else(|| token.strip_prefix("0X"))?;
    if hex.is_empty() || hex.len() > 16 || !hex.chars().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }
    let value = u64::from_str_radix(hex, 16).ok()?;
    let value = u32::try_from(value).ok()?;
    (value != 0).then(|| format!("0x{value:08X}"))
}

/// One raw event of the System log that says the machine went down, already reduced to what may leave.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RawEvent {
    pub event_id: u16,
    pub at_secs: i64,
    /// Kernel-Power 41: `BugcheckCode` (0 = no blue screen).
    pub bugcheck: Option<u32>,
    /// WER 1001 (`BugCheck`): the first parameter, which starts with the stop code.
    pub param1: Option<String>,
}

fn crash_of(e: &RawEvent) -> Option<Crash> {
    let (kind, code) = match e.event_id {
        41 => match e.bugcheck {
            Some(c) if c != 0 => (CrashKind::Bluescreen, Some(format!("0x{c:08X}"))),
            _ => (CrashKind::Unexpected, None),
        },
        1001 => {
            let code = e.param1.as_deref().and_then(stop_code)?;
            (CrashKind::Bluescreen, Some(code))
        }
        6008 => (CrashKind::Unexpected, None),
        _ => return None,
    };
    Some(Crash {
        at_secs: e.at_secs,
        kind,
        code,
    })
}

/// Events → crashes: newest first, events of one crash merged (a blue screen wins over "unexpected"),
/// at most `MAX_CRASHES`.
pub fn crashes(events: &[RawEvent]) -> Vec<Crash> {
    let mut all: Vec<Crash> = events.iter().filter_map(crash_of).collect();
    all.sort_by_key(|c| std::cmp::Reverse(c.at_secs));
    let mut out: Vec<Crash> = Vec::new();
    for c in all {
        if let Some(last) = out.last_mut() {
            if (last.at_secs - c.at_secs).abs() <= SAME_CRASH_SECS {
                if last.kind == CrashKind::Unexpected && c.kind == CrashKind::Bluescreen {
                    last.kind = CrashKind::Bluescreen;
                    last.code = c.code;
                } else if last.code.is_none() && c.code.is_some() {
                    last.code = c.code;
                }
                continue;
            }
        }
        out.push(c);
    }
    out.truncate(MAX_CRASHES);
    out
}

/// Seconds since 1970 from a Windows FILETIME (100 ns since 1601).
pub fn filetime_secs(ft: u64) -> i64 {
    (ft / 10_000_000) as i64 - 11_644_473_600
}

/// Reads both facts (blocking: run it off the UI thread).
pub fn read() -> Health {
    let (crashes_raw, crashes_read) = match imp::events() {
        Some(e) => (e, true),
        None => (Vec::new(), false),
    };
    Health {
        battery: imp::battery(),
        crashes: crashes(&crashes_raw),
        crashes_read,
    }
}

#[cfg(windows)]
mod imp {
    use super::{battery_health, filetime_secs, BatteryHealth, RawEvent, CRASH_DAYS};
    use windows::core::{PCWSTR, PWSTR};
    use windows::Win32::Devices::DeviceAndDriverInstallation::{
        SetupDiDestroyDeviceInfoList, SetupDiEnumDeviceInterfaces, SetupDiGetClassDevsW,
        SetupDiGetDeviceInterfaceDetailW, DIGCF_DEVICEINTERFACE, DIGCF_PRESENT,
        GUID_DEVCLASS_BATTERY, SP_DEVICE_INTERFACE_DATA, SP_DEVICE_INTERFACE_DETAIL_DATA_W,
    };
    use windows::Win32::Foundation::{CloseHandle, GENERIC_READ, GENERIC_WRITE, HANDLE};
    use windows::Win32::Storage::FileSystem::{
        CreateFileW, FILE_ATTRIBUTE_NORMAL, FILE_SHARE_READ, FILE_SHARE_WRITE, OPEN_EXISTING,
    };
    use windows::Win32::System::EventLog::{
        EvtClose, EvtCreateRenderContext, EvtNext, EvtQuery, EvtQueryChannelPath,
        EvtQueryReverseDirection, EvtRender, EvtRenderContextValues, EvtRenderEventValues,
        EvtVarTypeFileTime, EvtVarTypeString, EvtVarTypeUInt16, EvtVarTypeUInt32, EVT_HANDLE,
        EVT_VARIANT,
    };
    use windows::Win32::System::Power::{
        BatteryInformation, BATTERY_INFORMATION, BATTERY_QUERY_INFORMATION,
        IOCTL_BATTERY_QUERY_INFORMATION, IOCTL_BATTERY_QUERY_TAG,
    };
    use windows::Win32::System::IO::DeviceIoControl;

    struct Handle(HANDLE);
    impl Drop for Handle {
        fn drop(&mut self) {
            // SAFETY: the handle came from `CreateFileW` and is closed once.
            unsafe {
                let _ = CloseHandle(self.0);
            }
        }
    }

    /// The first battery's design and full-charge capacity via the battery class driver
    /// (`IOCTL_BATTERY_QUERY_INFORMATION`, no admin rights needed).
    pub fn battery() -> Option<BatteryHealth> {
        // SAFETY: plain SetupAPI enumeration; every buffer is sized from the API's own answer and
        // the device info list is destroyed on every path.
        unsafe {
            let set = SetupDiGetClassDevsW(
                Some(&GUID_DEVCLASS_BATTERY),
                PCWSTR::null(),
                None,
                DIGCF_PRESENT | DIGCF_DEVICEINTERFACE,
            )
            .ok()?;
            let result = (|| {
                let mut iface = SP_DEVICE_INTERFACE_DATA {
                    cbSize: std::mem::size_of::<SP_DEVICE_INTERFACE_DATA>() as u32,
                    ..Default::default()
                };
                SetupDiEnumDeviceInterfaces(set, None, &GUID_DEVCLASS_BATTERY, 0, &mut iface)
                    .ok()?;
                let mut needed = 0u32;
                let _ =
                    SetupDiGetDeviceInterfaceDetailW(set, &iface, None, 0, Some(&mut needed), None);
                if needed < std::mem::size_of::<SP_DEVICE_INTERFACE_DETAIL_DATA_W>() as u32 {
                    return None;
                }
                // u64 words keep the buffer aligned for the detail struct.
                let mut buf = vec![0u64; (needed as usize).div_ceil(8)];
                let detail = buf.as_mut_ptr() as *mut SP_DEVICE_INTERFACE_DETAIL_DATA_W;
                (*detail).cbSize = std::mem::size_of::<SP_DEVICE_INTERFACE_DETAIL_DATA_W>() as u32;
                SetupDiGetDeviceInterfaceDetailW(set, &iface, Some(detail), needed, None, None)
                    .ok()?;
                let path = PCWSTR((*detail).DevicePath.as_ptr());
                let file = CreateFileW(
                    path,
                    (GENERIC_READ | GENERIC_WRITE).0,
                    FILE_SHARE_READ | FILE_SHARE_WRITE,
                    None,
                    OPEN_EXISTING,
                    FILE_ATTRIBUTE_NORMAL,
                    None,
                )
                .ok()?;
                let file = Handle(file);
                let wait = 0u32;
                let mut tag = 0u32;
                let mut got = 0u32;
                DeviceIoControl(
                    file.0,
                    IOCTL_BATTERY_QUERY_TAG,
                    Some(&wait as *const u32 as *const _),
                    4,
                    Some(&mut tag as *mut u32 as *mut _),
                    4,
                    Some(&mut got),
                    None,
                )
                .ok()?;
                if tag == 0 {
                    return None;
                }
                let query = BATTERY_QUERY_INFORMATION {
                    BatteryTag: tag,
                    InformationLevel: BatteryInformation,
                    AtRate: 0,
                };
                let mut info = BATTERY_INFORMATION::default();
                DeviceIoControl(
                    file.0,
                    IOCTL_BATTERY_QUERY_INFORMATION,
                    Some(&query as *const _ as *const _),
                    std::mem::size_of::<BATTERY_QUERY_INFORMATION>() as u32,
                    Some(&mut info as *mut _ as *mut _),
                    std::mem::size_of::<BATTERY_INFORMATION>() as u32,
                    Some(&mut got),
                    None,
                )
                .ok()?;
                // Capacities are relative (not mWh) when this bit is set: no wear can be said then.
                const BATTERY_CAPACITY_RELATIVE: u32 = 0x4000_0000;
                if info.Capabilities & BATTERY_CAPACITY_RELATIVE != 0 {
                    return None;
                }
                battery_health(
                    info.DesignedCapacity,
                    info.FullChargedCapacity,
                    info.CycleCount,
                )
            })();
            let _ = SetupDiDestroyDeviceInfoList(set);
            result
        }
    }

    struct Evt(EVT_HANDLE);
    impl Drop for Evt {
        fn drop(&mut self) {
            // SAFETY: each handle came from the event log API and is closed once.
            unsafe {
                let _ = EvtClose(self.0);
            }
        }
    }

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    /// The System log's "went down" events of the last days: Kernel-Power 41, EventLog 6008 and
    /// WER-SystemErrorReporting 1001. Only the id, the time and the stop code are rendered.
    pub fn events() -> Option<Vec<RawEvent>> {
        let ms = u64::from(CRASH_DAYS) * 86_400_000;
        let query = wide(&format!(
            "*[System[((EventID=41 and Provider[@Name='Microsoft-Windows-Kernel-Power']) or \
             (EventID=6008 and Provider[@Name='EventLog']) or \
             (EventID=1001 and Provider[@Name='Microsoft-Windows-WER-SystemErrorReporting'])) \
             and TimeCreated[timediff(@SystemTime) <= {ms}]]]"
        ));
        let channel = wide("System");
        let paths: Vec<Vec<u16>> = [
            "Event/System/EventID",
            "Event/System/TimeCreated/@SystemTime",
            "Event/EventData/Data[@Name='BugcheckCode']",
            "Event/EventData/Data[@Name='param1']",
        ]
        .iter()
        .map(|p| wide(p))
        .collect();
        let path_ptrs: Vec<PCWSTR> = paths.iter().map(|p| PCWSTR(p.as_ptr())).collect();
        // SAFETY: every handle is wrapped and closed; the render buffer is sized from the API's
        // answer and read only for the four values asked for, by their reported type.
        unsafe {
            let results = Evt(EvtQuery(
                None,
                PCWSTR(channel.as_ptr()),
                PCWSTR(query.as_ptr()),
                EvtQueryChannelPath.0 | EvtQueryReverseDirection.0,
            )
            .ok()?);
            let context =
                Evt(EvtCreateRenderContext(Some(&path_ptrs), EvtRenderContextValues.0).ok()?);
            let mut out = Vec::new();
            let mut batch = [0isize; 16];
            loop {
                let mut returned = 0u32;
                if EvtNext(results.0, &mut batch, 1000, 0, &mut returned).is_err() {
                    break;
                }
                for &raw in &batch[..returned as usize] {
                    let event = Evt(EVT_HANDLE(raw));
                    if let Some(e) = render(context.0, event.0) {
                        out.push(e);
                    }
                }
                if out.len() >= 64 {
                    break;
                }
            }
            Some(out)
        }
    }

    unsafe fn render(context: EVT_HANDLE, event: EVT_HANDLE) -> Option<RawEvent> {
        let mut used = 0u32;
        let mut count = 0u32;
        let _ = EvtRender(
            Some(context),
            event,
            EvtRenderEventValues.0,
            0,
            None,
            &mut used,
            &mut count,
        );
        if used == 0 {
            return None;
        }
        let mut buf = vec![0u64; (used as usize).div_ceil(8)];
        EvtRender(
            Some(context),
            event,
            EvtRenderEventValues.0,
            used,
            Some(buf.as_mut_ptr() as *mut _),
            &mut used,
            &mut count,
        )
        .ok()?;
        if count < 4 {
            return None;
        }
        let values = std::slice::from_raw_parts(buf.as_ptr() as *const EVT_VARIANT, 4);
        let event_id =
            (values[0].Type == EvtVarTypeUInt16.0 as u32).then(|| values[0].Anonymous.UInt16Val)?;
        let at = (values[1].Type == EvtVarTypeFileTime.0 as u32)
            .then(|| values[1].Anonymous.FileTimeVal)?;
        let bugcheck =
            (values[2].Type == EvtVarTypeUInt32.0 as u32).then(|| values[2].Anonymous.UInt32Val);
        let param1 = (values[3].Type == EvtVarTypeString.0 as u32)
            .then(|| PWSTR(values[3].Anonymous.StringVal.0 as *mut u16))
            .filter(|p| !p.is_null())
            // Only the first 40 characters are needed for the stop code.
            .and_then(|p| p.to_string().ok())
            .map(|s| s.chars().take(40).collect());
        Some(RawEvent {
            event_id,
            at_secs: filetime_secs(at),
            bugcheck,
            param1,
        })
    }
}

#[cfg(not(windows))]
mod imp {
    use super::{BatteryHealth, RawEvent};
    pub fn battery() -> Option<BatteryHealth> {
        None
    }
    pub fn events() -> Option<Vec<RawEvent>> {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn battery_needs_both_capacities() {
        assert_eq!(
            battery_health(50_000, 41_000, 312),
            Some(BatteryHealth {
                design_mwh: 50_000,
                full_mwh: 41_000,
                cycles: Some(312)
            })
        );
        assert_eq!(battery_health(0, 41_000, 1), None);
        assert_eq!(battery_health(50_000, 0, 1), None);
        assert_eq!(battery_health(u32::MAX, 1, 1), None);
        assert_eq!(battery_health(10_000, 30_000, 1), None);
        assert_eq!(battery_health(50_000, 51_000, 0).unwrap().cycles, None);
    }

    #[test]
    fn stop_code_takes_only_the_code() {
        assert_eq!(
            stop_code("0x0000009f (0x0000000000000003, 0xffffa0012345)").as_deref(),
            Some("0x0000009F")
        );
        assert_eq!(stop_code("0x1a").as_deref(), Some("0x0000001A"));
        assert_eq!(stop_code("C:\\Windows\\MEMORY.DMP"), None);
        assert_eq!(stop_code("0x"), None);
        assert_eq!(stop_code("0x0"), None);
        assert_eq!(stop_code("0x1ffffffff"), None);
        assert_eq!(stop_code(""), None);
    }

    fn ev(event_id: u16, at_secs: i64, bugcheck: Option<u32>, param1: Option<&str>) -> RawEvent {
        RawEvent {
            event_id,
            at_secs,
            bugcheck,
            param1: param1.map(str::to_string),
        }
    }

    #[test]
    fn one_crash_is_one_entry_and_a_blue_screen_wins() {
        let list = crashes(&[
            ev(41, 10_000, Some(0), None),
            ev(6008, 10_060, None, None),
            ev(1001, 10_300, None, Some("0x00000133 (0x1, 0x2)")),
            ev(41, 50_000, Some(0), None),
        ]);
        assert_eq!(
            list,
            vec![
                Crash {
                    at_secs: 50_000,
                    kind: CrashKind::Unexpected,
                    code: None
                },
                Crash {
                    at_secs: 10_300,
                    kind: CrashKind::Bluescreen,
                    code: Some("0x00000133".into())
                },
            ]
        );
    }

    #[test]
    fn kernel_power_with_a_bugcheck_is_a_blue_screen() {
        let list = crashes(&[ev(41, 1, Some(0xEF), None)]);
        assert_eq!(list[0].kind, CrashKind::Bluescreen);
        assert_eq!(list[0].code.as_deref(), Some("0x000000EF"));
    }

    #[test]
    fn other_events_and_unreadable_reports_are_left_out_and_the_list_is_capped() {
        assert!(crashes(&[ev(7000, 1, None, None), ev(1001, 1, None, Some("text"))]).is_empty());
        let many: Vec<RawEvent> = (0..10).map(|i| ev(6008, i * 100_000, None, None)).collect();
        let list = crashes(&many);
        assert_eq!(list.len(), MAX_CRASHES);
        assert_eq!(list[0].at_secs, 900_000);
    }

    #[test]
    fn filetime_to_unix() {
        // 2024-01-01T00:00:00Z
        assert_eq!(filetime_secs(133_485_408_000_000_000), 1_704_067_200);
    }

    #[test]
    fn nothing_but_numbers_kinds_and_codes_leave() {
        let h = Health {
            battery: battery_health(50_000, 40_000, 3),
            crashes: crashes(&[ev(1001, 5, None, Some("0x9f C:\\secret"))]),
            crashes_read: true,
        };
        let text = format!("{h:?}");
        assert!(text.contains("0x0000009F"));
        assert!(!text.contains("secret"));
    }
}
