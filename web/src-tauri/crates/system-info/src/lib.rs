//! Read-only system facts. Nothing here changes the system, and nothing identifies the machine
//! beyond what the user sees on screen (no serial numbers, no MAC addresses).

use serde::Serialize;
use std::collections::HashMap;
use sysinfo::{
    MemoryRefreshKind, Networks, ProcessesToUpdate, System, MINIMUM_CPU_UPDATE_INTERVAL,
};

mod platform;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Cpu {
    pub brand: String,
    pub physical_cores: Option<usize>,
    pub threads: usize,
    /// Average load over all threads since the last snapshot, 0–100.
    pub usage_percent: f32,
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
    pub dedicated_bytes: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Iface {
    pub name: String,
    /// Local addresses (IPv4 and IPv6), no loopback and no link-local IPv6.
    pub addresses: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Info {
    pub os: String,
    pub uptime_secs: u64,
    pub cpu: Cpu,
    pub memory: Memory,
    pub battery: Option<Battery>,
    pub gpus: Vec<Gpu>,
    pub network: Vec<Iface>,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Proc {
    /// Program name; several processes of one program are summed up.
    pub name: String,
    pub memory_bytes: u64,
    pub instances: usize,
}

/// Keeps the sampler between calls: CPU load is a difference between two readings.
pub struct Monitor {
    sys: System,
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
        Monitor { sys }
    }

    /// A fresh reading. The first call waits the minimum sampling interval so the load is real.
    pub fn snapshot(&mut self) -> Info {
        std::thread::sleep(MINIMUM_CPU_UPDATE_INTERVAL);
        self.sys.refresh_cpu_usage();
        self.sys
            .refresh_memory_specifics(MemoryRefreshKind::nothing().with_ram());
        let cpus = self.sys.cpus();
        Info {
            os: System::long_os_version()
                .or_else(System::name)
                .unwrap_or_default(),
            uptime_secs: System::uptime(),
            cpu: Cpu {
                brand: cpus
                    .first()
                    .map(|c| c.brand().trim().to_string())
                    .unwrap_or_default(),
                physical_cores: System::physical_core_count(),
                threads: cpus.len(),
                usage_percent: self.sys.global_cpu_usage().clamp(0.0, 100.0),
            },
            memory: Memory {
                total_bytes: self.sys.total_memory(),
                used_bytes: self.sys.used_memory(),
            },
            battery: platform::battery(),
            gpus: platform::gpus(),
            network: interfaces(),
        }
    }

    /// The programs that use the most memory (instances of one program are summed).
    pub fn top_processes(&mut self, n: usize) -> Vec<Proc> {
        self.sys.refresh_processes(ProcessesToUpdate::All, true);
        let mut by_name: HashMap<String, (u64, usize)> = HashMap::new();
        for p in self.sys.processes().values() {
            let e = by_name
                .entry(p.name().to_string_lossy().into_owned())
                .or_default();
            e.0 += p.memory();
            e.1 += 1;
        }
        top_n(by_name, n)
    }
}

fn top_n(by_name: HashMap<String, (u64, usize)>, n: usize) -> Vec<Proc> {
    let mut all: Vec<Proc> = by_name
        .into_iter()
        .map(|(name, (memory_bytes, instances))| Proc {
            name,
            memory_bytes,
            instances,
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

fn keep_address(addr: &std::net::IpAddr) -> bool {
    match addr {
        std::net::IpAddr::V4(v4) => {
            !v4.is_loopback() && !v4.is_link_local() && !v4.is_unspecified()
        }
        std::net::IpAddr::V6(v6) => {
            // fe80::/10 (link-local) and ::1 are of no use to the user.
            !v6.is_loopback() && !v6.is_unspecified() && (v6.segments()[0] & 0xffc0) != 0xfe80
        }
    }
}

fn interfaces() -> Vec<Iface> {
    let nets = Networks::new_with_refreshed_list();
    let mut out: Vec<Iface> = nets
        .iter()
        .map(|(name, data)| {
            let mut addresses: Vec<String> = data
                .ip_networks()
                .iter()
                .filter(|n| keep_address(&n.addr))
                .map(|n| n.addr.to_string())
                .collect();
            addresses.sort();
            addresses.dedup();
            Iface {
                name: name.clone(),
                addresses,
            }
        })
        .filter(|i| !i.addresses.is_empty())
        .collect();
    out.sort_by(|a, b| a.name.cmp(&b.name));
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

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
        m.insert("b".to_string(), (10, 1));
        m.insert("a".to_string(), (10, 2));
        m.insert("c".to_string(), (99, 3));
        let top = top_n(m, 2);
        assert_eq!(
            top,
            vec![
                Proc {
                    name: "c".into(),
                    memory_bytes: 99,
                    instances: 3
                },
                Proc {
                    name: "a".into(),
                    memory_bytes: 10,
                    instances: 2
                }
            ]
        );
    }

    #[test]
    fn only_useful_addresses_are_kept() {
        assert!(keep_address(&IpAddr::V4(Ipv4Addr::new(192, 168, 1, 20))));
        assert!(!keep_address(&IpAddr::V4(Ipv4Addr::LOCALHOST)));
        assert!(!keep_address(&IpAddr::V4(Ipv4Addr::new(169, 254, 3, 4))));
        assert!(!keep_address(&IpAddr::V4(Ipv4Addr::UNSPECIFIED)));
        assert!(keep_address(&IpAddr::V6(
            "2001:db8::1".parse::<Ipv6Addr>().unwrap()
        )));
        assert!(!keep_address(&IpAddr::V6(
            "fe80::1".parse::<Ipv6Addr>().unwrap()
        )));
        assert!(!keep_address(&IpAddr::V6(Ipv6Addr::LOCALHOST)));
    }
}
