use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum State {
    /// Waiting for a free slot (at most three run at once).
    Queued,
    Running,
    Paused,
    Done,
    Failed,
}

/// Result of comparing the finished file with a hash the user pasted.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HashCheck {
    Match,
    Mismatch,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Job {
    pub id: u64,
    pub url: String,
    pub file_name: String,
    pub dir: PathBuf,
    pub state: State,
    pub done: u64,
    pub total: Option<u64>,
    /// Bytes per second for this job only; 0 = no own limit.
    pub limit_bps: u64,
    /// Current speed in bytes per second (not persisted meaningfully; 0 when not running).
    #[serde(default)]
    pub speed_bps: u64,
    /// Short code: `http`, `io`, `checksum`, `size`, `url`.
    pub error: Option<String>,
    /// SHA-256 of the finished file (hex).
    pub sha256: Option<String>,
    /// Hash the user wants the file checked against (SHA-256: 64, SHA-512: 128 hex characters).
    pub expected_hash: Option<String>,
    pub hash_check: Option<HashCheck>,
}

impl Job {
    pub fn final_path(&self) -> PathBuf {
        self.dir.join(&self.file_name)
    }

    pub fn part_path(&self) -> PathBuf {
        self.dir.join(format!("{}.part", self.file_name))
    }
}
