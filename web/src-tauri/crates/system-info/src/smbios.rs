//! Mainboard, BIOS and memory modules from the SMBIOS table (what `GetSystemFirmwareTable("RSMB")`
//! returns on Windows). Only descriptive text and sizes are read; serial numbers and asset tags are
//! deliberately never touched.

use crate::RamModule;

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Smbios {
    pub bios: Option<String>,
    pub board: Option<String>,
    pub ram: Vec<RamModule>,
}

fn string_at(strings: &[&[u8]], index: u8) -> Option<String> {
    if index == 0 {
        return None;
    }
    let s = strings.get(index as usize - 1)?;
    let s = String::from_utf8_lossy(s).trim().to_string();
    (!s.is_empty() && !is_placeholder(&s)).then_some(s)
}

/// Firmware vendors fill unset fields with these.
fn is_placeholder(s: &str) -> bool {
    let l = s.to_lowercase();
    l == "to be filled by o.e.m." || l == "default string" || l == "not specified" || l == "unknown"
}

fn u16_at(b: &[u8], off: usize) -> Option<u16> {
    Some(u16::from_le_bytes([*b.get(off)?, *b.get(off + 1)?]))
}

fn u32_at(b: &[u8], off: usize) -> Option<u32> {
    Some(u32::from_le_bytes([
        *b.get(off)?,
        *b.get(off + 1)?,
        *b.get(off + 2)?,
        *b.get(off + 3)?,
    ]))
}

fn memory_kind(code: u8) -> Option<&'static str> {
    Some(match code {
        0x12 => "DDR",
        0x13 => "DDR2",
        0x18 => "DDR3",
        0x1a => "DDR4",
        0x1b => "LPDDR",
        0x1c => "LPDDR2",
        0x1d => "LPDDR3",
        0x1e => "LPDDR4",
        0x22 => "DDR5",
        0x23 => "LPDDR5",
        _ => return None,
    })
}

/// Parses the raw SMBIOS structure table (without the `RawSMBIOSData` header).
pub fn parse(table: &[u8]) -> Smbios {
    let mut out = Smbios::default();
    let mut pos = 0usize;
    while pos + 4 <= table.len() {
        let kind = table[pos];
        let len = table[pos + 1] as usize;
        if len < 4 || pos + len > table.len() {
            break;
        }
        let formatted = &table[pos..pos + len];
        // The string set follows the formatted area and ends with a double NUL.
        let mut end = pos + len;
        while end + 1 < table.len() && !(table[end] == 0 && table[end + 1] == 0) {
            end += 1;
        }
        let strings: Vec<&[u8]> = if end > pos + len {
            table[pos + len..end].split(|b| *b == 0).collect()
        } else {
            Vec::new()
        };
        let next = end + 2;

        match kind {
            0 => {
                let vendor = formatted.get(4).and_then(|i| string_at(&strings, *i));
                let version = formatted.get(5).and_then(|i| string_at(&strings, *i));
                out.bios = match (vendor, version) {
                    (Some(v), Some(ver)) => Some(format!("{v} {ver}")),
                    (Some(v), None) => Some(v),
                    (None, Some(ver)) => Some(ver),
                    _ => None,
                };
            }
            2 => {
                let maker = formatted.get(4).and_then(|i| string_at(&strings, *i));
                let product = formatted.get(5).and_then(|i| string_at(&strings, *i));
                out.board = match (maker, product) {
                    (Some(m), Some(p)) => Some(format!("{m} {p}")),
                    (Some(m), None) => Some(m),
                    (None, Some(p)) => Some(p),
                    _ => None,
                };
            }
            17 => {
                if let Some(m) = memory_device(formatted, &strings) {
                    out.ram.push(m);
                }
            }
            127 => break,
            _ => {}
        }
        pos = next;
    }
    out
}

fn memory_device(f: &[u8], strings: &[&[u8]]) -> Option<RamModule> {
    let raw = u16_at(f, 0x0c)?;
    let size_bytes = match raw {
        0 | 0xffff => return None, // empty slot / unknown
        0x7fff => u64::from(u32_at(f, 0x1c)? & 0x7fff_ffff) * 1024 * 1024,
        r if r & 0x8000 != 0 => u64::from(r & 0x7fff) * 1024,
        r => u64::from(r) * 1024 * 1024,
    };
    let speed = u16_at(f, 0x20)
        .filter(|s| *s != 0 && *s != 0xffff)
        .or_else(|| u16_at(f, 0x15).filter(|s| *s != 0 && *s != 0xffff));
    Some(RamModule {
        size_bytes,
        speed_mhz: speed.map(u32::from),
        kind: f.get(0x12).and_then(|c| memory_kind(*c)).map(String::from),
        manufacturer: f.get(0x17).and_then(|i| string_at(strings, *i)),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// One structure: formatted bytes + its strings + the double NUL.
    fn structure(kind: u8, mut formatted: Vec<u8>, strings: &[&str]) -> Vec<u8> {
        let len = formatted.len() + 4;
        let mut out = vec![kind, len as u8, 0, 0];
        out.append(&mut formatted);
        if strings.is_empty() {
            out.extend([0, 0]);
        } else {
            for s in strings {
                out.extend(s.as_bytes());
                out.push(0);
            }
            out.push(0);
        }
        out
    }

    fn dimm(size_mb: u16, ty: u8, speed: u16, configured: u16, maker: u8) -> Vec<u8> {
        let mut f = vec![0u8; 0x22 - 4];
        f[0x0c - 4..0x0e - 4].copy_from_slice(&size_mb.to_le_bytes());
        f[0x12 - 4] = ty;
        f[0x15 - 4..0x17 - 4].copy_from_slice(&speed.to_le_bytes());
        f[0x17 - 4] = maker;
        f[0x20 - 4..0x22 - 4].copy_from_slice(&configured.to_le_bytes());
        f
    }

    #[test]
    fn reads_bios_board_and_memory_modules() {
        let mut t = Vec::new();
        t.extend(structure(0, vec![1, 2, 0, 0, 0], &["American Megatrends", "F31"]));
        t.extend(structure(2, vec![1, 2], &["ASUSTeK COMPUTER INC.", "ROG STRIX B650-F"]));
        t.extend(structure(17, dimm(16384, 0x22, 6400, 6000, 1), &["Corsair"]));
        t.extend(structure(17, dimm(16384, 0x22, 6400, 6000, 1), &["Corsair"]));
        t.extend(structure(17, dimm(0, 0, 0, 0, 0), &[])); // empty slot
        t.extend(structure(127, vec![], &[]));
        let s = parse(&t);
        assert_eq!(s.bios.as_deref(), Some("American Megatrends F31"));
        assert_eq!(s.board.as_deref(), Some("ASUSTeK COMPUTER INC. ROG STRIX B650-F"));
        assert_eq!(s.ram.len(), 2);
        assert_eq!(s.ram[0].size_bytes, 16 * 1024 * 1024 * 1024);
        assert_eq!(s.ram[0].speed_mhz, Some(6000));
        assert_eq!(s.ram[0].kind.as_deref(), Some("DDR5"));
        assert_eq!(s.ram[0].manufacturer.as_deref(), Some("Corsair"));
    }

    #[test]
    fn placeholders_and_garbage_are_ignored() {
        let mut t = Vec::new();
        t.extend(structure(2, vec![1, 2], &["To Be Filled By O.E.M.", "Default string"]));
        let s = parse(&t);
        assert_eq!(s.board, None);
        // truncated input must not panic
        assert_eq!(parse(&[0, 200, 0, 0, 1]).ram.len(), 0);
        assert_eq!(parse(&[]), Smbios::default());
    }

    #[test]
    fn falls_back_to_the_rated_speed_and_unknown_type() {
        let mut t = Vec::new();
        t.extend(structure(17, dimm(8192, 0x99, 3200, 0, 0), &[]));
        let s = parse(&t);
        assert_eq!(s.ram[0].speed_mhz, Some(3200));
        assert_eq!(s.ram[0].kind, None);
        assert_eq!(s.ram[0].manufacturer, None);
    }
}
