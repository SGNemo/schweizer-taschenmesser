/**
 * Contract of the download manager's native side (`src-tauri/src/downloads.rs`, desktop only).
 * Jobs live in Rust (persisted there, resumed after a restart); the page only watches the list and
 * sends commands. Nothing is started without a call, nothing downloaded is ever opened or run.
 */

export type DownloadState = 'queued' | 'running' | 'paused' | 'done' | 'failed';

export interface DownloadJob {
  id: number;
  url: string;
  fileName: string;
  /** Folder the file is written to. */
  dir: string;
  state: DownloadState;
  done: number;
  total: number | null;
  /** Own limit in bytes per second; 0 = none. */
  limitBps: number;
  /** Current speed in bytes per second. */
  speedBps: number;
  /** `http`, `io`, `checksum`, `size` */
  error: string | null;
  /** SHA-256 of the finished file. */
  sha256: string | null;
  expectedHash: string | null;
  hashCheck: 'match' | 'mismatch' | null;
}

export interface DownloadsService {
  supported: boolean;
  /** The list now and after every change. Returns when the first list was delivered. */
  watch(onList: (jobs: DownloadJob[]) => void): Promise<void>;
  defaultDir(): Promise<string>;
  /** Opens the system folder dialog; `null` when the user cancels. */
  pickDir(): Promise<string | null>;
  /** Rejects with a short code: `url`, `scheme`, `dir`, `hash`. */
  add(url: string, dir: string, expectedHash?: string): Promise<DownloadJob>;
  pause(id: number): Promise<void>;
  resume(id: number): Promise<void>;
  remove(id: number, deleteData: boolean): Promise<void>;
  /** All downloads together, bytes per second; 0 = none. */
  setLimit(bps: number): Promise<void>;
  setJobLimit(id: number, bps: number): Promise<void>;
  verify(id: number, expected: string): Promise<void>;
  /** Shows the file (or its folder) in the file manager. */
  reveal(id: number): Promise<void>;
}
