//! BitTorrent engine of the Downloads module (embedded librqbit).
//!
//! Rules: it only takes what the user hands over (a magnet link or the bytes of a `.torrent` file),
//! never searches, never lists indexing sites. Torrents that were running at the last exit come back
//! **paused**; nothing starts by itself. Seeding stops by itself at the ratio / time the user set.
//! Nothing downloaded is ever opened or run.

mod engine;
mod seed;
mod types;

pub use engine::{Engine, EngineConfig, MAX_TORRENT_FILE};
pub use seed::SeedLimits;
pub use types::{FileEntry, Preview, Source, TorrentInfo, TorrentState};
