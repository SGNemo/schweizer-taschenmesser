use serde::Serialize;

/// What the user handed over.
#[derive(Debug, Clone)]
pub enum Source {
    /// `magnet:?xt=urn:btih:…` (BitTorrent v1 info hash).
    Magnet(String),
    /// The bytes of a `.torrent` file the user opened.
    File(Vec<u8>),
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub index: usize,
    pub path: String,
    pub size: u64,
}

/// File list of a torrent before it is added (a magnet link first has to fetch it from peers).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Preview {
    pub info_hash: String,
    pub name: String,
    pub total: u64,
    pub files: Vec<FileEntry>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum TorrentState {
    /// Checking files / waiting for metadata.
    Starting,
    Downloading,
    /// Complete and uploading.
    Seeding,
    Paused,
    /// Complete; stopped because the ratio / time limit was reached.
    Done,
    Error,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TorrentInfo {
    pub id: usize,
    pub info_hash: String,
    pub name: String,
    pub dir: String,
    pub state: TorrentState,
    pub progress_bytes: u64,
    pub total_bytes: u64,
    pub uploaded_bytes: u64,
    /// Bytes per second.
    pub down_bps: u64,
    pub up_bps: u64,
    /// Peers we are talking to right now.
    pub peers: u32,
    /// `uploaded / total`; 0 while the total is unknown.
    pub ratio: f64,
    pub error: Option<String>,
}
