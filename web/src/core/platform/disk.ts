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
  /** Parent folder relative to the scan root; only present in `query` results. */
  relPath?: string;
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
  /** Folders without any file (own or nested); folders only. */
  onlyEmpty?: boolean;
}

/** Well-known cache/temp folders offered as scan roots (only ones that exist). */
export interface Place {
  id: 'temp' | 'chrome' | 'edge' | 'firefox' | 'downloads' | 'cache';
  path: string;
}

/** Why the block list refuses an entry (`Denied::code()` in Rust). */
export type DenyReason =
  | 'missing'
  | 'drive-root'
  | 'system-folder'
  | 'user-profile'
  | 'app-data'
  | 'system-file'
  | 'own-app'
  | 'running-program'
  | 'scan-root'
  | 'not-an-entry';

export type DeleteMode = 'trash' | 'permanent';
export type PlanFlag = 'large' | 'userData' | 'program';

export interface PlanItem {
  nodeId: number;
  name: string;
  /** Full path, as shown in the confirmation. */
  path: string;
  isDir: boolean;
  bytes: number;
  files: number;
  flags: PlanFlag[];
  drive: DriveKind;
}

export interface PlanDenied {
  nodeId: number;
  name: string;
  reason: DenyReason;
}

/** Result of the check before deleting; nothing has been touched yet. Valid for five minutes. */
export interface DeletePlan {
  planId: number;
  items: PlanItem[];
  denied: PlanDenied[];
  totalBytes: number;
  totalFiles: number;
  large: boolean;
  /** Exact text to type before a move to the recycle bin (null = plain confirmation). */
  trashConfirmation: string | null;
  /** Exact text to type before a permanent delete (null only when nothing can be deleted). */
  permanentConfirmation: string | null;
  /** False when an item is on a network/removable drive, where the recycle bin often cannot be used. */
  trashLikely: boolean;
}

export type DeleteOutcome =
  'deleted' | 'partial' | 'failed' | 'skipped' | 'trashUnavailable' | 'cancelled';

export interface EntryError {
  path: string;
  reason: 'in-use' | 'denied' | 'other';
}

export interface DeleteItemReport {
  node: number;
  name: string;
  outcome: DeleteOutcome;
  /** A `DenyReason`, `changed`, or an error reason. */
  reason: string | null;
  filesDeleted: number;
  bytes: number;
  errors: EntryError[];
  errorsTotal: number;
}

export interface DeleteReport {
  mode: DeleteMode;
  items: DeleteItemReport[];
  cancelled: boolean;
  filesDeleted: number;
  freedBytes: number;
  /** The scan root after the tree was corrected. */
  rootNode: DiskNode | null;
}

export interface DeleteProgress {
  itemsDone: number;
  itemsTotal: number;
  current: string;
  filesDeleted: number;
}

export interface DupGroup {
  size: number;
  wasted: number;
  files: DiskNode[];
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
  knownPlaces(): Promise<Place[]>;
  nodePath(scanId: number, node: number): Promise<string>;
  /** Shows the entry in Explorer. */
  reveal(scanId: number, node: number): Promise<void>;
  /** The block list's verdict for one entry: null = may be offered for deletion. */
  canDelete(scanId: number, node: number): Promise<DenyReason | null>;
  planDelete(scanId: number, nodes: number[]): Promise<DeletePlan>;
  /**
   * Runs a plan. `confirm` must be the phrase the plan asks for (checked natively, too).
   * Rejects with `Error(code)`, e.g. `confirmation-mismatch`, `plan-expired`.
   */
  runDelete(
    planId: number,
    mode: DeleteMode,
    confirm: string | null,
    onProgress: (p: DeleteProgress) => void,
  ): Promise<DeleteReport>;
  cancelDelete(planId: number): Promise<void>;
  /** Identical files below `under` (size, partial hash, full hash). Nothing is deleted. */
  findDuplicates(scanId: number, under: number): Promise<DupGroup[]>;
  cancelDuplicates(scanId: number): Promise<void>;
}
