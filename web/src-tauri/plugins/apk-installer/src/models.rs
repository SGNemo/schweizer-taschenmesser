use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadRequest {
    /// https URL of the APK: must be a release asset of this repository (`validate.rs`).
    pub url: String,
    /// Expected SHA-256, 64 lowercase hex characters (required, `validate.rs`). The download is
    /// rejected and deleted when it does not match.
    pub sha256: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResponse {
    pub path: String,
    pub sha256: String,
    pub size: u64,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressResponse {
    pub downloaded: u64,
    /// 0 while the server has not announced a length.
    pub total: u64,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallRequest {
    pub path: String,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallResponse {
    /// `started` (installer opened) or `needs-permission` (the user must allow installs from this app first).
    pub status: String,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CanInstallResponse {
    pub allowed: bool,
}
