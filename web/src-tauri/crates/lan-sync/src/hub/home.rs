//! The one stored home network (CONCEPT §4): a single id in a JSON file, written atomically.
//! Only the first pairing stores it; changing it is an explicit user action (the shell asks first).

use super::netpolicy::{HomeNetworkStore, NetError};
use std::path::{Path, PathBuf};

pub struct FileHomeNetwork {
    path: PathBuf,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct File {
    v: u32,
    #[serde(rename = "networkId")]
    network_id: String,
}

impl FileHomeNetwork {
    pub fn new(path: &Path) -> Self {
        FileHomeNetwork {
            path: path.to_owned(),
        }
    }

    /// Stores `id` (replacing any earlier one).
    pub fn set(&self, id: &str) -> Result<(), NetError> {
        let bytes = serde_json::to_vec(&File {
            v: 1,
            network_id: id.to_owned(),
        })
        .map_err(|_| NetError)?;
        let mut tmp = self.path.clone().into_os_string();
        tmp.push(".tmp");
        std::fs::write(&tmp, bytes).map_err(|_| NetError)?;
        std::fs::rename(&tmp, &self.path).map_err(|_| NetError)
    }

    /// Stores `id` only if no home network is stored yet; `Ok(true)` if it did.
    pub fn set_if_empty(&self, id: &str) -> Result<bool, NetError> {
        if self.home_network_id()?.is_some() {
            return Ok(false);
        }
        self.set(id)?;
        Ok(true)
    }
}

impl HomeNetworkStore for FileHomeNetwork {
    /// A missing file means "none"; an unreadable or malformed one is an error (fail-closed).
    fn home_network_id(&self) -> Result<Option<String>, NetError> {
        match std::fs::read(&self.path) {
            Ok(b) => {
                let f: File = serde_json::from_slice(&b).map_err(|_| NetError)?;
                if f.v != 1 || f.network_id.is_empty() {
                    return Err(NetError);
                }
                Ok(Some(f.network_id))
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(_) => Err(NetError),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stores_one_id_and_never_silently_replaces_on_set_if_empty() {
        let d = std::env::temp_dir().join(format!("lan-sync-home-{}", std::process::id()));
        std::fs::create_dir_all(&d).unwrap();
        let h = FileHomeNetwork::new(&d.join("home.json"));
        assert_eq!(h.home_network_id(), Ok(None));
        assert_eq!(h.set_if_empty("net-a"), Ok(true));
        assert_eq!(h.set_if_empty("net-b"), Ok(false));
        assert_eq!(h.home_network_id(), Ok(Some("net-a".into())));
        h.set("net-b").unwrap();
        assert_eq!(h.home_network_id(), Ok(Some("net-b".into())));
        std::fs::write(d.join("home.json"), b"nope").unwrap();
        assert_eq!(
            h.home_network_id(),
            Err(NetError),
            "malformed is an error, not none"
        );
        std::fs::remove_dir_all(d).ok();
    }
}
