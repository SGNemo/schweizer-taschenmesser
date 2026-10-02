//! The parts sysinfo does not cover: battery, graphics adapters, adapter details, Wi-Fi, firmware
//! facts, monitors and default audio devices. Everything is read-only and needs no admin rights;
//! whatever cannot be read is simply left out.

use crate::gpu::{merge_gpus, DxgiAdapter, RegistryAdapter};
use crate::net::RawAdapter;
use crate::{Battery, Gpu, Hardware, WifiState};

pub fn gpus() -> Vec<Gpu> {
    merge_gpus(&imp::dxgi_adapters(), &imp::registry_gpus())
}

pub fn battery() -> Option<Battery> {
    imp::battery()
}

pub fn hardware() -> Hardware {
    imp::hardware()
}

/// Detailed adapter list; `None` where only the generic sysinfo data exists.
pub fn adapters() -> Option<Vec<RawAdapter>> {
    imp::adapters()
}

pub fn wifi() -> Option<WifiState> {
    imp::wifi()
}

#[cfg(windows)]
mod imp {
    use super::*;
    use crate::net::RawV6;
    use crate::{smbios, Display, RamModule};
    use std::net::{Ipv4Addr, Ipv6Addr};
    use windows::core::{w, PCWSTR};
    use windows::Win32::Foundation::{ERROR_SUCCESS, LPARAM, RECT};
    use windows::Win32::Graphics::Dxgi::{
        CreateDXGIFactory1, IDXGIFactory1, DXGI_ADAPTER_FLAG_SOFTWARE,
    };
    use windows::Win32::Graphics::Gdi::{
        EnumDisplayMonitors, EnumDisplaySettingsW, GetMonitorInfoW, DEVMODEW,
        ENUM_CURRENT_SETTINGS, HDC, HMONITOR, MONITORINFO, MONITORINFOEXW,
    };
    use windows::Win32::NetworkManagement::IpHelper::{
        GetAdaptersAddresses, GAA_FLAG_SKIP_ANYCAST, GAA_FLAG_SKIP_DNS_SERVER,
        GAA_FLAG_SKIP_MULTICAST, IP_ADAPTER_ADDRESSES_LH,
    };
    use windows::Win32::NetworkManagement::Ndis::IfOperStatusUp;
    use windows::Win32::Networking::WinSock::{AF_INET, AF_INET6, SOCKADDR_IN, SOCKADDR_IN6};
    use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
    use windows::Win32::System::Registry::{
        RegCloseKey, RegEnumKeyExW, RegOpenKeyExW, RegQueryValueExW, HKEY, HKEY_LOCAL_MACHINE,
        KEY_READ, REG_VALUE_TYPE,
    };
    use windows::Win32::System::SystemInformation::GetSystemFirmwareTable;

    pub fn battery() -> Option<Battery> {
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

    fn utf16(buf: &[u16]) -> String {
        let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
        String::from_utf16_lossy(&buf[..end])
    }

    fn pwstr(p: windows::core::PWSTR) -> String {
        if p.is_null() {
            return String::new();
        }
        // SAFETY: the OS returns NUL-terminated strings that live as long as the adapter buffer.
        unsafe { p.to_string().unwrap_or_default() }
    }

    pub fn dxgi_adapters() -> Vec<DxgiAdapter> {
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
                out.push(DxgiAdapter {
                    name: utf16(&desc.Description),
                    vendor_id: desc.VendorId,
                    software: desc.Flags & DXGI_ADAPTER_FLAG_SOFTWARE.0 as u32 != 0,
                    dedicated_bytes: desc.DedicatedVideoMemory as u64,
                    shared_bytes: desc.SharedSystemMemory as u64,
                    luid: (u64::from(desc.AdapterLuid.HighPart as u32) << 32)
                        | u64::from(desc.AdapterLuid.LowPart),
                    has_outputs: adapter.EnumOutputs(0).is_ok(),
                });
            }
        }
        out
    }

    // ---- registry helpers -------------------------------------------------------------------

    struct Key(HKEY);
    impl Key {
        fn open(parent: HKEY, path: PCWSTR) -> Option<Key> {
            let mut h = HKEY::default();
            // SAFETY: `path` is NUL-terminated; `h` is a live out pointer closed in `Drop`.
            let r = unsafe { RegOpenKeyExW(parent, path, Some(0), KEY_READ, &mut h) };
            (r == ERROR_SUCCESS).then_some(Key(h))
        }

        fn raw(&self, name: PCWSTR) -> Option<(REG_VALUE_TYPE, Vec<u8>)> {
            let mut ty = REG_VALUE_TYPE::default();
            let mut len = 0u32;
            // SAFETY: first call only asks for the size; `ty`/`len` are live locals.
            let r = unsafe {
                RegQueryValueExW(self.0, name, None, Some(&mut ty), None, Some(&mut len))
            };
            if r != ERROR_SUCCESS || len == 0 {
                return None;
            }
            let mut buf = vec![0u8; len as usize];
            // SAFETY: `buf` has exactly `len` bytes.
            let r = unsafe {
                RegQueryValueExW(
                    self.0,
                    name,
                    None,
                    Some(&mut ty),
                    Some(buf.as_mut_ptr()),
                    Some(&mut len),
                )
            };
            (r == ERROR_SUCCESS).then(|| {
                buf.truncate(len as usize);
                (ty, buf)
            })
        }

        fn string(&self, name: PCWSTR) -> Option<String> {
            let (_, bytes) = self.raw(name)?;
            let wide: Vec<u16> = bytes
                .chunks_exact(2)
                .map(|c| u16::from_le_bytes([c[0], c[1]]))
                .collect();
            let s = utf16(&wide).trim().to_string();
            (!s.is_empty()).then_some(s)
        }

        fn number(&self, name: PCWSTR) -> Option<u64> {
            let (_, b) = self.raw(name)?;
            match b.len() {
                8 => Some(u64::from_le_bytes(b[..8].try_into().ok()?)),
                4 => Some(u64::from(u32::from_le_bytes(b[..4].try_into().ok()?))),
                _ => None,
            }
        }
    }
    impl Drop for Key {
        fn drop(&mut self) {
            // SAFETY: the handle was opened by `Key::open` and is closed exactly once.
            unsafe {
                let _ = RegCloseKey(self.0);
            }
        }
    }

    /// Installed display adapters with driver version and real video memory (no admin needed).
    pub fn registry_gpus() -> Vec<RegistryAdapter> {
        let Some(class) = Key::open(
            HKEY_LOCAL_MACHINE,
            w!(r"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}"),
        ) else {
            return Vec::new();
        };
        let mut out = Vec::new();
        for i in 0..32u32 {
            let mut name = [0u16; 64];
            let mut len = name.len() as u32;
            // SAFETY: `name`/`len` describe a live buffer.
            let r = unsafe {
                RegEnumKeyExW(
                    class.0,
                    i,
                    Some(windows::core::PWSTR(name.as_mut_ptr())),
                    &mut len,
                    None,
                    None,
                    None,
                    None,
                )
            };
            if r != ERROR_SUCCESS {
                break;
            }
            let sub = utf16(&name);
            if !sub.chars().all(|c| c.is_ascii_digit()) {
                continue; // "Configuration", "Properties"
            }
            let wide: Vec<u16> = sub.encode_utf16().chain(std::iter::once(0)).collect();
            let Some(k) = Key::open(class.0, PCWSTR(wide.as_ptr())) else {
                continue;
            };
            let Some(desc) = k.string(w!("DriverDesc")) else {
                continue;
            };
            out.push(RegistryAdapter {
                name: desc,
                driver_version: k.string(w!("DriverVersion")),
                vendor: k.string(w!("ProviderName")),
                memory_bytes: k
                    .number(w!("HardwareInformation.qwMemorySize"))
                    .or_else(|| k.number(w!("HardwareInformation.MemorySize"))),
            });
        }
        out
    }

    // ---- hardware facts ----------------------------------------------------------------------

    fn smbios_table() -> Option<Vec<u8>> {
        const RSMB: u32 = 0x5253_4D42; // 'RSMB'
                                       // SAFETY: the first call only asks for the size; the second fills a buffer of that size.
        unsafe {
            let size = GetSystemFirmwareTable(
                windows::Win32::System::SystemInformation::FIRMWARE_TABLE_PROVIDER(RSMB),
                0,
                None,
            );
            if size < 8 {
                return None;
            }
            let mut buf = vec![0u8; size as usize];
            let got = GetSystemFirmwareTable(
                windows::Win32::System::SystemInformation::FIRMWARE_TABLE_PROVIDER(RSMB),
                0,
                Some(&mut buf),
            );
            if got == 0 || got > size {
                return None;
            }
            buf.truncate(got as usize);
            // RawSMBIOSData: 4 bytes of versions, a u32 length, then the structure table.
            let len = u32::from_le_bytes(buf[4..8].try_into().ok()?) as usize;
            let table = buf.get(8..8 + len.min(buf.len() - 8))?;
            Some(table.to_vec())
        }
    }

    fn windows_build() -> Option<String> {
        let k = Key::open(
            HKEY_LOCAL_MACHINE,
            w!(r"SOFTWARE\Microsoft\Windows NT\CurrentVersion"),
        )?;
        let build = k.string(w!("CurrentBuild"))?;
        let ubr = k.number(w!("UBR"));
        let version = k
            .string(w!("DisplayVersion"))
            .or_else(|| k.string(w!("ReleaseId")));
        Some(format!(
            "{}Build {}{}",
            version.map(|v| format!("{v} · ")).unwrap_or_default(),
            build,
            ubr.map(|u| format!(".{u}")).unwrap_or_default()
        ))
    }

    unsafe extern "system" fn monitor_proc(
        hmon: HMONITOR,
        _hdc: HDC,
        _rect: *mut RECT,
        data: LPARAM,
    ) -> windows::core::BOOL {
        // SAFETY: `data` is the `Vec<Display>` passed by `displays()`, alive for the whole call.
        let list = unsafe { &mut *(data.0 as *mut Vec<Display>) };
        let mut info = MONITORINFOEXW::default();
        info.monitorInfo.cbSize = std::mem::size_of::<MONITORINFOEXW>() as u32;
        // SAFETY: `info` is a live struct with `cbSize` set as the API requires.
        if unsafe { GetMonitorInfoW(hmon, std::ptr::from_mut(&mut info).cast::<MONITORINFO>()) }
            .as_bool()
        {
            let mut dm = DEVMODEW {
                dmSize: std::mem::size_of::<DEVMODEW>() as u16,
                ..Default::default()
            };
            // SAFETY: `szDevice` is NUL-terminated by the OS; `dm` is a live struct.
            if unsafe {
                EnumDisplaySettingsW(
                    PCWSTR(info.szDevice.as_ptr()),
                    ENUM_CURRENT_SETTINGS,
                    &mut dm,
                )
            }
            .as_bool()
            {
                list.push(Display {
                    width: dm.dmPelsWidth,
                    height: dm.dmPelsHeight,
                    refresh_hz: dm.dmDisplayFrequency,
                    primary: info.monitorInfo.dwFlags & 1 != 0, // MONITORINFOF_PRIMARY
                });
            }
        }
        true.into()
    }

    fn displays() -> Vec<Display> {
        let mut list: Vec<Display> = Vec::new();
        // SAFETY: the callback only touches the vector behind the pointer, which outlives the call.
        unsafe {
            let _ = EnumDisplayMonitors(
                None,
                None,
                Some(monitor_proc),
                LPARAM(std::ptr::from_mut(&mut list) as isize),
            );
        }
        list.sort_by_key(|d| !d.primary);
        list
    }

    pub fn hardware() -> Hardware {
        let audio = audio();
        let sm = smbios_table()
            .map(|t| smbios::parse(&t))
            .unwrap_or_default();
        Hardware {
            board: sm.board,
            bios: sm.bios,
            ram: sm.ram.into_iter().collect::<Vec<RamModule>>(),
            windows_build: windows_build(),
            displays: displays(),
            audio_output: audio.0,
            audio_input: audio.1,
        }
    }

    // ---- adapters ----------------------------------------------------------------------------

    pub fn adapters() -> Option<Vec<RawAdapter>> {
        let flags = GAA_FLAG_SKIP_ANYCAST | GAA_FLAG_SKIP_MULTICAST | GAA_FLAG_SKIP_DNS_SERVER;
        let mut size = 0u32;
        // SAFETY: the first call only asks for the required buffer size.
        unsafe { GetAdaptersAddresses(0, flags, None, None, &mut size) };
        if size == 0 {
            return None;
        }
        // 8-byte aligned buffer for the linked structures.
        let mut buf = vec![0u64; (size as usize).div_ceil(8)];
        let first = buf.as_mut_ptr().cast::<IP_ADAPTER_ADDRESSES_LH>();
        // SAFETY: `first` points at `size` writable bytes.
        let r = unsafe { GetAdaptersAddresses(0, flags, None, Some(first), &mut size) };
        if r != 0 {
            return None;
        }
        let mut out = Vec::new();
        let mut cur = first;
        // SAFETY: the OS built a well-formed linked list inside `buf`, which outlives the loop.
        unsafe {
            while !cur.is_null() {
                let a = &*cur;
                let mut raw = RawAdapter {
                    name: pwstr(a.FriendlyName),
                    description: pwstr(a.Description),
                    if_type: a.IfType,
                    up: a.OperStatus == IfOperStatusUp,
                    ..Default::default()
                };
                let mut u = a.FirstUnicastAddress;
                while !u.is_null() {
                    let ua = &*u;
                    let sa = ua.Address.lpSockaddr;
                    if !sa.is_null() {
                        let family = (*sa).sa_family;
                        if family == AF_INET {
                            let sin = &*(sa.cast::<SOCKADDR_IN>());
                            raw.v4
                                .push(Ipv4Addr::from(sin.sin_addr.S_un.S_addr.to_ne_bytes()));
                        } else if family == AF_INET6 {
                            let sin6 = &*(sa.cast::<SOCKADDR_IN6>());
                            raw.v6.push(RawV6 {
                                addr: Ipv6Addr::from(sin6.sin6_addr.u.Byte),
                                // NlsoRandom: privacy ("temporary") address.
                                temporary: ua.SuffixOrigin.0 == 5,
                                // IpDadStateDeprecated.
                                deprecated: ua.DadState.0 == 3,
                            });
                        }
                    }
                    u = ua.Next;
                }
                out.push(raw);
                cur = a.Next;
            }
        }
        Some(out)
    }

    /// Name of the default audio endpoint (`render` = speakers, else microphone).
    fn default_audio(render: bool) -> Option<String> {
        use windows::Win32::Devices::FunctionDiscovery::PKEY_Device_FriendlyName;
        use windows::Win32::Media::Audio::{
            eCapture, eConsole, eRender, IMMDeviceEnumerator, MMDeviceEnumerator,
        };
        use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_ALL, STGM_READ};
        // SAFETY: COM calls on smart pointers; COM is initialised by the caller on this thread.
        unsafe {
            let en: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).ok()?;
            let dev = en
                .GetDefaultAudioEndpoint(if render { eRender } else { eCapture }, eConsole)
                .ok()?;
            let store = dev.OpenPropertyStore(STGM_READ).ok()?;
            let value = store.GetValue(&PKEY_Device_FriendlyName).ok()?;
            let name = value.to_string();
            (!name.trim().is_empty()).then_some(name)
        }
    }

    /// Default speakers and microphone; COM is set up and torn down around the calls.
    fn audio() -> (Option<String>, Option<String>) {
        use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_MULTITHREADED};
        // SAFETY: balanced with `CoUninitialize` below, and only when initialisation succeeded.
        let inited = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) }.is_ok();
        let out = (default_audio(true), default_audio(false));
        if inited {
            // SAFETY: matches the successful `CoInitializeEx` above.
            unsafe { CoUninitialize() };
        }
        out
    }

    pub fn wifi() -> Option<WifiState> {
        use windows::Win32::Foundation::HANDLE;
        use windows::Win32::NetworkManagement::WiFi::{
            wlan_interface_state_connected, wlan_intf_opcode_current_connection, WlanCloseHandle,
            WlanEnumInterfaces, WlanFreeMemory, WlanOpenHandle, WlanQueryInterface,
            WLAN_CONNECTION_ATTRIBUTES, WLAN_INTERFACE_INFO_LIST,
        };
        let mut negotiated = 0u32;
        let mut handle = HANDLE::default();
        // SAFETY: out pointers are live locals; the handle is closed before returning.
        unsafe {
            if WlanOpenHandle(2, None, &mut negotiated, &mut handle) != 0 {
                return None;
            }
            let mut list: *mut WLAN_INTERFACE_INFO_LIST = std::ptr::null_mut();
            let mut result = None;
            if WlanEnumInterfaces(handle, None, &mut list) == 0 && !list.is_null() {
                let n = (*list).dwNumberOfItems as usize;
                let items = std::slice::from_raw_parts((*list).InterfaceInfo.as_ptr(), n);
                if let Some(i) = items
                    .iter()
                    .find(|i| i.isState == wlan_interface_state_connected)
                {
                    let description = utf16(&i.strInterfaceDescription);
                    let mut size = 0u32;
                    let mut data: *mut core::ffi::c_void = std::ptr::null_mut();
                    let q = WlanQueryInterface(
                        handle,
                        &i.InterfaceGuid,
                        wlan_intf_opcode_current_connection,
                        None,
                        &mut size,
                        &mut data,
                        None,
                    );
                    let (mut ssid, mut signal) = (None, None);
                    if q == 0 && !data.is_null() {
                        let a = &*(data as *const WLAN_CONNECTION_ATTRIBUTES);
                        let assoc = &a.wlanAssociationAttributes;
                        let len = (assoc.dot11Ssid.uSSIDLength as usize).min(32);
                        let name = String::from_utf8_lossy(&assoc.dot11Ssid.ucSSID[..len])
                            .trim()
                            .to_string();
                        ssid = (!name.is_empty()).then_some(name);
                        signal = Some(assoc.wlanSignalQuality.min(100) as u8);
                    }
                    if !data.is_null() {
                        WlanFreeMemory(data);
                    }
                    result = Some(WifiState {
                        description,
                        ssid,
                        signal_percent: signal,
                    });
                }
                WlanFreeMemory(list.cast());
            }
            let _ = WlanCloseHandle(handle, None);
            result
        }
    }
}

#[cfg(all(unix, not(target_os = "macos")))]
mod imp {
    use super::*;

    pub fn dxgi_adapters() -> Vec<DxgiAdapter> {
        Vec::new()
    }

    pub fn registry_gpus() -> Vec<RegistryAdapter> {
        Vec::new()
    }

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

    fn dmi(name: &str) -> Option<String> {
        let s = std::fs::read_to_string(format!("/sys/class/dmi/id/{name}")).ok()?;
        let s = s.trim().to_string();
        (!s.is_empty()).then_some(s)
    }

    /// Board and BIOS from the readable DMI files (never the serial numbers).
    pub fn hardware() -> Hardware {
        let join = |a: Option<String>, b: Option<String>| match (a, b) {
            (Some(a), Some(b)) => Some(format!("{a} {b}")),
            (a, b) => a.or(b),
        };
        Hardware {
            board: join(dmi("board_vendor"), dmi("board_name")),
            bios: join(dmi("bios_vendor"), dmi("bios_version")),
            ..Default::default()
        }
    }

    pub fn adapters() -> Option<Vec<RawAdapter>> {
        None
    }

    pub fn wifi() -> Option<WifiState> {
        None
    }
}

#[cfg(not(any(windows, all(unix, not(target_os = "macos")))))]
mod imp {
    use super::*;

    pub fn dxgi_adapters() -> Vec<DxgiAdapter> {
        Vec::new()
    }
    pub fn registry_gpus() -> Vec<RegistryAdapter> {
        Vec::new()
    }
    pub fn battery() -> Option<Battery> {
        None
    }
    pub fn hardware() -> Hardware {
        Hardware::default()
    }
    pub fn adapters() -> Option<Vec<RawAdapter>> {
        None
    }
    pub fn wifi() -> Option<WifiState> {
        None
    }
}
