/**
 * Contract of the disk module's native side (`src-tauri/src/disk.rs`, crate `disk-scan`).
 * The scan tree lives in Rust; the webview only sees views of it and refers to entries by node id.
 */

export type DriveKind = 'fixed' | 'removable' | 'network' | 'ram' | 'unknown';
export type DriveMedia = 'ssd' | 'hdd' | 'unknown';

export interface DriveInfo {
  /** Scan root, e.g. `C:\`. */
  root: string;
  label: string;
  fileSystem: string;
  kind: DriveKind;
  media: DriveMedia;
  totalBytes: number;
  freeBytes: number;
}

/** Same order as `FileKind::ALL` in Rust (index into `kindBytes`). */
export const FILE_KINDS = [
  'video',
  'image',
  'audio',
  'archive',
  'program',
  'document',
  'other',
] as const;
export type FileKind = (typeof FILE_KINDS)[number];

export type DiskNodeKind = 'dir' | 'file' | 'small';

export interface DiskNode {
  id: number;
  parentId: number | null;
  /** Empty for the aggregate "small files" entry; the scan root carries its full path. */
  name: string;
  kind: DiskNodeKind;
  /** Space used on the volume (rounded up to clusters): the main measure. */
  bytes: number;
  /** Plain file size (differs by cluster rounding, sparse files, cloud placeholders). */
  logicalBytes: number;
  files: number;
  /** Newest change in the subtree, Unix seconds. */
  modified: number;
  fileKind: FileKind;
  kindBytes: number[];
  childCount: number;
}

export interface ScanProgress {
  files: number;
  dirs: number;
  bytes: number;
  current: string;
}

export type NotReadReason = 'denied' | 'vanished' | 'too-deep' | 'error';

export interface NotRead {
  path: string;
  reason: NotReadReason;
}

export interface ScanSummary {
  scanId: number;
  root: string;
  rootNode: DiskNode;
  cancelled: boolean;
  files: number;
  dirs: number;
  bytes: number;
  logicalBytes: number;
  /** Files that are only online (cloud placeholders): not part of `bytes`. */
  cloudBytes: number;
  /** Links, junctions and online-only folders that were not entered. */
  skippedLinks: number;
  notRead: NotRead[];
  notReadTotal: number;
  elapsedMs: number;
}

export interface DiskQuery {
  scope: 'dirs' | 'files';
  under?: number;
  /** Only entries whose newest change is older than this Unix time (seconds). */
  olderThan?: number;
  fileKind?: FileKind;
  minBytes?: number;
  limit?: number;
}

export interface ScanHandle {
  scanId: number;
  /** Resolves with the summary (also when cancelled); rejects with `Error(code)` on failure. */
  result: Promise<ScanSummary>;
}

/** Desktop only; `supported` is false in the browser and on Android. */
export interface DiskService {
  supported: boolean;
  listDrives(): Promise<DriveInfo[]>;
  startScan(root: string, onProgress: (p: ScanProgress) => void): Promise<ScanHandle>;
  cancelScan(scanId: number): Promise<void>;
  pauseScan(scanId: number, paused: boolean): Promise<void>;
  /** Frees the scan's memory in the native side. */
  dropScan(scanId: number): Promise<void>;
  children(scanId: number, node: number, depth: number, minBytes: number): Promise<DiskNode[]>;
  node(scanId: number, node: number): Promise<DiskNode | null>;
  query(scanId: number, query: DiskQuery): Promise<DiskNode[]>;
}
