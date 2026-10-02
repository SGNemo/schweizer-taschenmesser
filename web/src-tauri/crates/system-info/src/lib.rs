//! Read-only system facts. Nothing here changes the system, and nothing identifies the machine
//! beyond what the user sees on screen (no serial numbers, no MAC addresses).

use serde::Serialize;
use std::collections::HashMap;
use std::time::Instant;
use sysinfo::{
    DiskRefreshKind, Disks, MemoryRefreshKind, Networks, ProcessesToUpdate, System,
    MINIMUM_CPU_UPDATE_INTERVAL,
};

pub mod gpu;
pub mod net;
mod platform;
pub mod smbios;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Cpu {
    pub brand: String,
    pub physical_cores: Option<usize>,
    pub threads: usize,
    /// Average load over all threads since the last snapshot, 0–100.
    pub usage_percent: f32,
    /// Current clock in MHz, when the system reports it.
    pub frequency_mhz: Option<u64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Memory {
    pub total_bytes: u64,
    pub used_bytes: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Battery {
    /// 0–100; `None` when the level is unknown.
    pub percent: Option<u8>,
    pub charging: bool,
    pub plugged_in: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Gpu {
    pub name: String,
    /// Own video memory; 0 for integrated adapters (they use `shared_bytes`).
    pub dedicated_bytes: u64,
    /// System memory the adapter may borrow.
    pub shared_bytes: u64,
    pub driver_version: Option<String>,
    pub vendor: Option<String>,
    /// The adapter that drives a screen.
    pub active: bool,
}

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum IfaceKind {
    Ethernet,
    Wifi,
    Virtual,
    Other,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Iface {
    pub name: String,
    pub kind: IfaceKind,
    /// Connected.
    pub up: bool,
    pub ipv4: Vec<String>,
    /// The one useful IPv6 address (no link-local, no temporary ones).
    pub ipv6: Option<String>,
    /// Everything else ("alle anzeigen").
    pub ipv6_other: Vec<String>,
    /// Wi-Fi only; `None` when the system does not tell (e.g. no location permission).
    pub ssid: Option<String>,
    pub signal_percent: Option<u8>,
    pub down_bytes_per_sec: Option<u64>,
    pub up_bytes_per_sec: Option<u64>,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RamModule {
    pub size_bytes: u64,
    pub speed_mhz: Option<u32>,
    /// "DDR4", "DDR5", …
    pub kind: Option<String>,
    pub manufacturer: Option<String>,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Display {
    pub width: u32,
    pub height: u32,
    pub refresh_hz: u32,
    pub primary: bool,
}

/// Slowly changing facts; read now and then, not on every snapshot.
#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Hardware {
    pub board: Option<String>,
    pub bios: Option<String>,
    pub ram: Vec<RamModule>,
    pub windows_build: Option<String>,
    pub displays: Vec<Display>,
    pub audio_output: Option<String>,
    pub audio_input: Option<String>,
}

/// Read and write speed of one volume since the previous reading.
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiskIo {
    pub root: String,
    pub read_bytes_per_sec: u64,
    pub write_bytes_per_sec: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Info {
    pub os: String,
    pub uptime_secs: u64,
    /// Start of the last boot, seconds since 1970.
    pub boot_time_secs: u64,
    pub cpu: Cpu,
    pub memory: Memory,
    pub battery: Option<Battery>,
    pub gpus: Vec<Gpu>,
    pub network: Vec<Iface>,
    pub hardware: Hardware,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Proc {
    /// Program name; several processes of one program are summed up.
    pub name: String,
    pub memory_bytes: u64,
    pub instances: usize,
    /// Share of the whole CPU (all threads), 0–100; 0 until the second reading.
    pub cpu_percent: f32,
}

/// How often the slow hardware facts (displays, audio devices) are read again, in snapshots.
const HARDWARE_EVERY: u32 = 20;

/// Keeps the samplers between calls: CPU load and rates are differences between two readings.
pub struct Monitor {
    sys: System,
    nets: Networks,
    disks: Disks,
    last_net: Instant,
    last_disk: Instant,
    prev_net: HashMap<String, (u64, u64)>,
    hardware: Option<Hardware>,
    snapshots: u32,
}

impl Default for Monitor {
    fn default() -> Self {
        Self::new()
    }
}

impl Monitor {
    pub fn new() -> Monitor {
        let mut sys = System::new();
        sys.refresh_cpu_usage();
        let nets = Networks::new_with_refreshed_list();
        let prev_net = counters(&nets);
        let mut disks = Disks::new_with_refreshed_list_specifics(DiskRefreshKind::nothing());
        disks.refresh_specifics(true, DiskRefreshKind::nothing().with_io_usage());
        Monitor {
            sys,
            nets,
            disks,
            last_net: Instant::now(),
            last_disk: Instant::now(),
            prev_net,
            hardware: None,
            snapshots: 0,
        }
    }

    /// A fresh reading. The first call waits the minimum sampling interval so the load is real.
    pub fn snapshot(&mut self) -> Info {
        std::thread::sleep(MINIMUM_CPU_UPDATE_INTERVAL);
        self.sys.refresh_cpu_usage();
        self.sys
            .refresh_memory_specifics(MemoryRefreshKind::nothing().with_ram());
        if self.hardware.is_none() || self.snapshots % HARDWARE_EVERY == 0 {
            self.hardware = Some(platform::hardware());
        }
        self.snapshots = self.snapshots.wrapping_add(1);
        let network = self.interfaces();
        let cpus = self.sys.cpus();
        Info {
            os: System::long_os_version()
                .or_else(System::name)
                .unwrap_or_default(),
            uptime_secs: System::uptime(),
            boot_time_secs: System::boot_time(),
            cpu: Cpu {
                brand: cpus
                    .first()
                    .map(|c| c.brand().trim().to_string())
                    .unwrap_or_default(),
                physical_cores: System::physical_core_count(),
                threads: cpus.len(),
                usage_percent: self.sys.global_cpu_usage().clamp(0.0, 100.0),
                frequency_mhz: cpus
                    .iter()
                    .map(|c| c.frequency())
                    .max()
                    .filter(|f| *f > 0),
            },
            memory: Memory {
                total_bytes: self.sys.total_memory(),
                used_bytes: self.sys.used_memory(),
            },
            battery: platform::battery(),
            gpus: platform::gpus(),
            network,
            hardware: self.hardware.clone().unwrap_or_default(),
        }
    }

    /// The programs that use the most memory (instances of one program are summed).
    pub fn top_processes(&mut self, n: usize) -> Vec<Proc> {
        self.sys.refresh_processes(ProcessesToUpdate::All, true);
        let threads = self.sys.cpus().len().max(1) as f32;
        let mut by_name: HashMap<String, (u64, usize, f32)> = HashMap::new();
        for p in self.sys.processes().values() {
            let e = by_name
                .entry(p.name().to_string_lossy().into_owned())
                .or_default();
            e.0 += p.memory();
            e.1 += 1;
            e.2 += p.cpu_usage();
        }
        top_n(by_name, n, threads)
    }

    /// Read/write speed per volume since the previous call (display only).
    pub fn disk_io(&mut self) -> Vec<DiskIo> {
        self.disks
            .refresh_specifics(true, DiskRefreshKind::nothing().with_io_usage());
        let secs = self.last_disk.elapsed().as_secs_f64();
        self.last_disk = Instant::now();
        if secs <= 0.0 {
            return Vec::new();
        }
        self.disks
            .list()
            .iter()
            .map(|d| {
                let u = d.usage();
                DiskIo {
                    root: d.mount_point().to_string_lossy().into_owned(),
                    read_bytes_per_sec: (u.read_bytes as f64 / secs).round() as u64,
                    write_bytes_per_sec: (u.written_bytes as f64 / secs).round() as u64,
                }
            })
            .collect()
    }

    fn interfaces(&mut self) -> Vec<Iface> {
        self.nets.refresh(true);
        let secs = self.last_net.elapsed().as_secs_f64();
        self.last_net = Instant::now();
        let now = counters(&self.nets);
        let mut rates: HashMap<String, (u64, u64)> = HashMap::new();
        for (name, (rx, tx)) in &now {
            if let Some((prx, ptx)) = self.prev_net.get(name) {
                if let (Some(d), Some(u)) = (net::rate(*prx, *rx, secs), net::rate(*ptx, *tx, secs))
                {
                    rates.insert(name.clone(), (d, u));
                }
            }
        }
        self.prev_net = now;

        let raw = platform::adapters().unwrap_or_else(|| sysinfo_adapters(&self.nets));
        let descriptions: HashMap<String, String> = raw
            .iter()
            .map(|r| (r.name.clone(), r.description.clone()))
            .collect();
        let mut list: Vec<Iface> = raw.iter().map(net::classify).collect();
        net::apply_rates(&mut list, &descriptions, &rates);
        if let Some(w) = platform::wifi() {
            // The connected Wi-Fi adapter: matched by description, else the first one.
            let target = raw
                .iter()
                .position(|r| r.description == w.description)
                .or_else(|| list.iter().position(|i| i.kind == IfaceKind::Wifi));
            if let Some(i) = target.and_then(|i| list.get_mut(i)) {
                i.ssid = w.ssid;
                i.signal_percent = w.signal_percent;
            }
        }
        net::visible(list)
    }
}

/// What the Wi-Fi radio reports about the current connection.
pub struct WifiState {
    pub description: String,
    pub ssid: Option<String>,
    pub signal_percent: Option<u8>,
}

fn counters(nets: &Networks) -> HashMap<String, (u64, u64)> {
    nets.iter()
        .map(|(n, d)| (n.clone(), (d.total_received(), d.total_transmitted())))
        .collect()
}

/// Adapter facts from sysinfo alone (non-Windows systems and development).
fn sysinfo_adapters(nets: &Networks) -> Vec<net::RawAdapter> {
    nets.iter()
        .map(|(name, data)| {
            let mut a = net::RawAdapter {
                name: name.clone(),
                up: true,
                ..Default::default()
            };
            for n in data.ip_networks() {
                match n.addr {
                    std::net::IpAddr::V4(v4) => a.v4.push(v4),
                    std::net::IpAddr::V6(v6) => a.v6.push(net::RawV6 {
                        addr: v6,
                        temporary: false,
                        deprecated: false,
                    }),
                }
            }
            a
        })
        .collect()
}

fn top_n(by_name: HashMap<String, (u64, usize, f32)>, n: usize, threads: f32) -> Vec<Proc> {
    let mut all: Vec<Proc> = by_name
        .into_iter()
        .map(|(name, (memory_bytes, instances, cpu))| Proc {
            name,
            memory_bytes,
            instances,
            cpu_percent: (cpu / threads).clamp(0.0, 100.0),
        })
        .collect();
    all.sort_by(|a, b| {
        b.memory_bytes
            .cmp(&a.memory_bytes)
            .then_with(|| a.name.cmp(&b.name))
    });
    all.truncate(n);
    all
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_snapshot_has_sane_numbers() {
        let info = Monitor::new().snapshot();
        assert!(info.memory.total_bytes > 0);
        assert!(info.memory.used_bytes <= info.memory.total_bytes);
        assert!(info.cpu.threads >= 1);
        assert!((0.0..=100.0).contains(&info.cpu.usage_percent));
        assert!(info.uptime_secs > 0);
        if let Some(b) = &info.battery {
            assert!(b.percent.is_none_or(|p| p <= 100));
        }
    }

    #[test]
    fn top_processes_are_sorted_and_limited() {
        let procs = Monitor::new().top_processes(5);
        assert!(!procs.is_empty() && procs.len() <= 5);
        assert!(procs
            .windows(2)
            .all(|w| w[0].memory_bytes >= w[1].memory_bytes));
        assert!(procs.iter().all(|p| p.instances >= 1 && !p.name.is_empty()));
    }

    #[test]
    fn instances_of_one_program_are_summed_and_ties_break_by_name() {
        let mut m = HashMap::new();
        m.insert("b".to_string(), (10, 1, 0.0));
        m.insert("a".to_string(), (10, 2, 40.0));
        m.insert("c".to_string(), (99, 3, 400.0));
        let top = top_n(m, 2, 8.0);
        assert_eq!(
            top,
            vec![
                Proc {
                    name: "c".into(),
                    memory_bytes: 99,
                    instances: 3,
                    cpu_percent: 50.0
                },
                Proc {
                    name: "a".into(),
                    memory_bytes: 10,
                    instances: 2,
                    cpu_percent: 5.0
                }
            ]
        );
    }
}
