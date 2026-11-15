//! Read-only facts for the recommendations of the drives tab. Nothing here changes anything.

use crate::reg::Registry;
use serde::Serialize;

/// Where Windows keeps the file system's "tell the drive about deleted blocks" switch (the one
/// `fsutil behavior query DisableDeleteNotify` reports). Machine hive, readable without admin.
const FILE_SYSTEM: &str = r"SYSTEM\CurrentControlSet\Control\FileSystem";
const DISABLE_DELETE_NOTIFY: &str = "DisableDeleteNotification";

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Health {
    /// TRIM is switched off for NTFS (`Some(true)`), on (`Some(false)`), or not known (`None`:
    /// the value is missing or cannot be read – then nothing is claimed).
    pub trim_off: Option<bool>,
}

/// `Some(true)` only for the documented "off" value 1, `Some(false)` only for 0.
pub fn trim_off(reg: &dyn Registry) -> Option<bool> {
    match reg
        .machine_get(FILE_SYSTEM, DISABLE_DELETE_NOTIFY)
        .ok()
        .flatten()?
        .as_dword()?
    {
        0 => Some(false),
        1 => Some(true),
        _ => None,
    }
}

pub fn health(reg: &dyn Registry) -> Health {
    Health {
        trim_off: trim_off(reg),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::reg::{MemRegistry, Value};

    #[test]
    fn trim_is_only_reported_for_the_two_documented_values() {
        let reg = MemRegistry::new();
        assert_eq!(trim_off(&reg), None, "missing");
        for (value, expected) in [
            (Value::Dword(0), Some(false)),
            (Value::Dword(1), Some(true)),
            (Value::Dword(7), None),
            (Value::Sz("1".into()), None),
        ] {
            reg.seed_machine(FILE_SYSTEM, DISABLE_DELETE_NOTIFY, value);
            assert_eq!(trim_off(&reg), expected);
        }
        assert_eq!(reg.user_len(), 0, "nothing is ever written");
    }

    #[test]
    fn the_wire_format_is_camel_case() {
        let json = serde_json::to_string(&Health {
            trim_off: Some(true),
        })
        .unwrap();
        assert_eq!(json, r#"{"trimOff":true}"#);
    }
}
