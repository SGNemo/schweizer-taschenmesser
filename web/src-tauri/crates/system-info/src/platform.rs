//! Battery and graphics adapters: the parts sysinfo does not cover.

use crate::{Battery, Gpu};

#[cfg(windows)]
pub fn battery() -> Option<Battery> {
    use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
    let mut s = SYSTEM_POWER_STATUS::default();
    // SAFETY: `s` is a live, writable struct of the exact type the call fills.
    unsafe { GetSystemPowerStatus(&mut s) }.ok()?;
    // BatteryFlag: 128 = no battery, 255 = unknown.
    if s.BatteryFlag == 128 || s.BatteryFlag == 255 {
        return None;
    }
    Some(Battery {
        percent: (s.BatteryLifePercent <= 100).then_some(s.BatteryLifePercent),
        charging: s.BatteryFlag & 8 != 0,
        plugged_in: s.ACLineStatus == 1,
    })
}

#[cfg(windows)]
pub fn gpus() -> Vec<Gpu> {
    use windows::Win32::Graphics::Dxgi::{
        CreateDXGIFactory1, IDXGIFactory1, DXGI_ADAPTER_FLAG_SOFTWARE,
    };
    let mut out = Vec::new();
    // SAFETY: plain COM calls on interfaces owned by `windows` smart pointers; the description
    // struct is filled by the call and read only afterwards.
    unsafe {
        let Ok(factory) = CreateDXGIFactory1::<IDXGIFactory1>() else {
            return out;
        };
        let mut i = 0;
        while let Ok(adapter) = factory.EnumAdapters1(i) {
            i += 1;
            let Ok(desc) = adapter.GetDesc1() else {
                continue;
            };
            if desc.Flags & DXGI_ADAPTER_FLAG_SOFTWARE.0 as u32 != 0 {
                continue; // the "Basic Render Driver" is not a graphics card
            }
            let end = desc
                .Description
                .iter()
                .position(|&c| c == 0)
                .unwrap_or(desc.Description.len());
            out.push(Gpu {
                name: String::from_utf16_lossy(&desc.Description[..end]),
                dedicated_bytes: desc.DedicatedVideoMemory as u64,
            });
        }
    }
    out
}

#[cfg(all(unix, not(target_os = "macos")))]
pub fn battery() -> Option<Battery> {
    let dir = std::fs::read_dir("/sys/class/power_supply").ok()?;
    for e in dir.flatten() {
        let p = e.path();
        if std::fs::read_to_string(p.join("type")).ok()?.trim() != "Battery" {
            continue;
        }
        let percent = std::fs::read_to_string(p.join("capacity"))
            .ok()
            .and_then(|s| s.trim().parse::<u8>().ok())
            .filter(|p| *p <= 100);
        let status = std::fs::read_to_string(p.join("status")).unwrap_or_default();
        let status = status.trim();
        return Some(Battery {
            percent,
            charging: status == "Charging",
            plugged_in: status == "Charging" || status == "Full",
        });
    }
    None
}

#[cfg(all(unix, not(target_os = "macos")))]
pub fn gpus() -> Vec<Gpu> {
    Vec::new()
}

#[cfg(not(any(windows, all(unix, not(target_os = "macos")))))]
pub fn battery() -> Option<Battery> {
    None
}

#[cfg(not(any(windows, all(unix, not(target_os = "macos")))))]
pub fn gpus() -> Vec<Gpu> {
    Vec::new()
}
