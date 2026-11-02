/**
 * Contract of the torrent engine's native side (`src-tauri/src/torrent.rs`, desktop only).
 * The page hands over a magnet link or the path of a `.torrent` file the user opened; nothing is
 * searched and nothing that was downloaded is ever opened or run. The engine only starts with
 * `configure` (after the user switched the torrent part on and confirmed the notice).
 */

export type TorrentState = 'starting' | 'downloading' | 'seeding' | 'paused' | 'done' | 'error';

export interface TorrentInfo {
  id: number;
  infoHash: string;
  name: string;
  dir: string;
  state: TorrentState;
  progressBytes: number;
  totalBytes: number;
  uploadedBytes: number;
  /** Bytes per second. */
  downBps: number;
  upBps: number;
  /** Peers connected right now. */
  peers: number;
  /** Uploaded / size. */
  ratio: number;
  error: string | null;
}

export interface TorrentFile {
  index: number;
  path: string;
  size: number;
}

export interface TorrentPreview {
  infoHash: string;
  name: string;
  total: number;
  files: TorrentFile[];
}

export type TorrentSource =
  | { kind: 'magnet'; value: string }
  /** `value` = path from the system file dialog. */
  | { kind: 'file'; value: string };

export interface TorrentSettings {
  /** Distributed hash table (finds peers for magnet links); only read when the engine starts. */
  dht: boolean;
  /** Open the listen port on the router; only read when the engine starts. */
  upnp: boolean;
  /** KB/s, 0 = unlimited. */
  uploadKb: number;
  downloadKb: number;
  /** Stop seeding at this ratio; 0 = no limit. */
  seedRatio: number;
  /** Stop seeding this many minutes after the download finished; 0 = no limit. */
  seedMinutes: number;
}

export interface TorrentService {
  supported: boolean;
  /** Starts the engine (first call) and applies the limits. */
  configure(settings: TorrentSettings): Promise<void>;
  /** Shuts the engine down; saved torrents stay in the list for the next start (paused). */
  stop(): Promise<void>;
  /** Rejects with `off`, `file`, `not-a-magnet`, `timeout`, `already-added`, `other`. */
  preview(source: TorrentSource): Promise<TorrentPreview>;
  /** `files` = indices to download, omitted = all. Resolves with the torrent's id. */
  add(source: TorrentSource, dir: string, files?: number[]): Promise<number>;
  pause(id: number): Promise<void>;
  resume(id: number): Promise<void>;
  remove(id: number, deleteData: boolean): Promise<void>;
  /** The list now and about once a second. */
  watch(onList: (torrents: TorrentInfo[]) => void): Promise<void>;
  /** System dialog for a `.torrent` file; `null` when cancelled. */
  pickFile(): Promise<string | null>;
}
