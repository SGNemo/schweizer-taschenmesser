//! Graphics adapters: merges what DXGI and the display-class registry key report.
//!
//! DXGI alone is not enough: it also lists the "Microsoft Basic Render Driver" (sometimes without
//! the software flag), reports 0 bytes for integrated adapters and may miss a card entirely in
//! unusual sessions. The registry lists the installed adapters with their driver version and the
//! real video memory. Both are merged here; the function is pure so fixtures can test it.

use crate::Gpu;

/// Vendor id of Microsoft's software adapters (Basic Render Driver, WARP).
const MICROSOFT_VENDOR: u32 = 0x1414;

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct DxgiAdapter {
    pub name: String,
    pub vendor_id: u32,
    pub software: bool,
    pub dedicated_bytes: u64,
    pub shared_bytes: u64,
    /// Unique per adapter; used to drop duplicates.
    pub luid: u64,
    /// A monitor is plugged into this adapter, i.e. it drives the screen.
    pub has_outputs: bool,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct RegistryAdapter {
    pub name: String,
    pub driver_version: Option<String>,
    pub vendor: Option<String>,
    pub memory_bytes: Option<u64>,
}

fn is_software_name(name: &str) -> bool {
    let n = name.to_lowercase();
    n.contains("basic render") || n.contains("basic display") || n.contains("warp")
}

fn same_card(a: &str, b: &str) -> bool {
    let (a, b) = (a.trim().to_lowercase(), b.trim().to_lowercase());
    !a.is_empty() && (a == b || a.contains(&b) || b.contains(&a))
}

/// Real graphics cards only, in a stable order: the active one first, then by video memory.
pub fn merge_gpus(dxgi: &[DxgiAdapter], registry: &[RegistryAdapter]) -> Vec<Gpu> {
    let mut seen_luid = std::collections::HashSet::new();
    let mut used_reg = vec![false; registry.len()];
    let mut out: Vec<(Gpu, bool)> = Vec::new();

    for a in dxgi {
        if a.software || a.vendor_id == MICROSOFT_VENDOR || is_software_name(&a.name) {
            continue;
        }
        if a.luid != 0 && !seen_luid.insert(a.luid) {
            continue;
        }
        let reg = registry
            .iter()
            .enumerate()
            .find(|(i, r)| !used_reg[*i] && same_card(&a.name, &r.name));
        if let Some((i, _)) = reg {
            used_reg[i] = true;
        }
        let reg = reg.map(|(_, r)| r);
        let dedicated = if a.dedicated_bytes > 0 {
            a.dedicated_bytes
        } else {
            reg.and_then(|r| r.memory_bytes).unwrap_or(0)
        };
        out.push((
            Gpu {
                name: a.name.trim().to_string(),
                dedicated_bytes: dedicated,
                shared_bytes: a.shared_bytes,
                driver_version: reg.and_then(|r| r.driver_version.clone()),
                vendor: reg.and_then(|r| r.vendor.clone()),
                active: false,
            },
            a.has_outputs,
        ));
    }

    // Adapters DXGI did not list (it can miss a card), taken from the registry alone.
    for (i, r) in registry.iter().enumerate() {
        if used_reg[i] || r.name.trim().is_empty() || is_software_name(&r.name) {
            continue;
        }
        if out.iter().any(|(g, _)| same_card(&g.name, &r.name)) {
            continue;
        }
        out.push((
            Gpu {
                name: r.name.trim().to_string(),
                dedicated_bytes: r.memory_bytes.unwrap_or(0),
                shared_bytes: 0,
                driver_version: r.driver_version.clone(),
                vendor: r.vendor.clone(),
                active: false,
            },
            false,
        ));
    }

    out.sort_by(|(a, a_out), (b, b_out)| {
        b_out
            .cmp(a_out)
            .then_with(|| b.dedicated_bytes.cmp(&a.dedicated_bytes))
            .then_with(|| a.name.cmp(&b.name))
    });
    // The adapter that drives a screen is the active one; without that hint, the biggest card.
    if let Some((first, _)) = out.first_mut() {
        first.active = true;
    }
    out.into_iter().map(|(g, _)| g).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    const GB: u64 = 1024 * 1024 * 1024;

    fn dxgi(name: &str, vendor: u32, dedicated: u64, luid: u64, outputs: bool) -> DxgiAdapter {
        DxgiAdapter {
            name: name.into(),
            vendor_id: vendor,
            software: false,
            dedicated_bytes: dedicated,
            shared_bytes: 16 * GB,
            luid,
            has_outputs: outputs,
        }
    }

    fn reg(name: &str, mem: Option<u64>) -> RegistryAdapter {
        RegistryAdapter {
            name: name.into(),
            driver_version: Some("31.0.15.5123".into()),
            vendor: Some("NVIDIA".into()),
            memory_bytes: mem,
        }
    }

    #[test]
    fn the_basic_render_driver_is_never_listed_even_without_the_software_flag() {
        let list = merge_gpus(
            &[
                dxgi("Microsoft Basic Render Driver", 0x1414, 0, 1, false),
                dxgi("NVIDIA GeForce RTX 4070", 0x10de, 12 * GB, 2, true),
            ],
            &[reg("NVIDIA GeForce RTX 4070", Some(12 * GB))],
        );
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].name, "NVIDIA GeForce RTX 4070");
        assert_eq!(list[0].dedicated_bytes, 12 * GB);
        assert_eq!(list[0].driver_version.as_deref(), Some("31.0.15.5123"));
        assert!(list[0].active);
    }

    #[test]
    fn a_card_that_dxgi_misses_comes_from_the_registry() {
        let list = merge_gpus(
            &[dxgi("Microsoft Basic Render Driver", 0x1414, 0, 1, true)],
            &[reg("NVIDIA GeForce RTX 4070", Some(12 * GB))],
        );
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].name, "NVIDIA GeForce RTX 4070");
        assert_eq!(list[0].dedicated_bytes, 12 * GB);
    }

    #[test]
    fn missing_dxgi_memory_is_filled_from_the_registry() {
        let list = merge_gpus(
            &[dxgi("NVIDIA GeForce RTX 4070", 0x10de, 0, 2, true)],
            &[reg("NVIDIA GeForce RTX 4070", Some(12 * GB))],
        );
        assert_eq!(list[0].dedicated_bytes, 12 * GB);
    }

    #[test]
    fn integrated_and_discrete_are_both_listed_and_the_one_with_a_screen_is_active() {
        let list = merge_gpus(
            &[
                dxgi("AMD Radeon(TM) Graphics", 0x1002, 512 * 1024 * 1024, 3, false),
                dxgi("NVIDIA GeForce RTX 4070", 0x10de, 12 * GB, 2, true),
            ],
            &[],
        );
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].name, "NVIDIA GeForce RTX 4070");
        assert!(list[0].active && !list[1].active);
        assert_eq!(list[1].shared_bytes, 16 * GB);
    }

    #[test]
    fn duplicates_by_luid_collapse_but_two_identical_cards_stay() {
        let a = dxgi("Card", 0x10de, GB, 5, true);
        assert_eq!(merge_gpus(&[a.clone(), a.clone()], &[]).len(), 1);
        let b = dxgi("Card", 0x10de, GB, 6, false);
        assert_eq!(merge_gpus(&[a, b], &[]).len(), 2);
    }

    #[test]
    fn nothing_in_nothing_out_and_software_flag_is_honoured() {
        assert!(merge_gpus(&[], &[]).is_empty());
        let mut soft = dxgi("Whatever", 0x1234, 0, 9, false);
        soft.software = true;
        assert!(merge_gpus(&[soft], &[]).is_empty());
    }
}
