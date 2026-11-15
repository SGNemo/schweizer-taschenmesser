import type { DiskNode } from './disk';

/**
 * PC care of the "Dieser PC" module (desktop): clean-up suggestions, the history of what the page
 * changed on this PC, and Windows' own tools. Lives at `getPlatform().disk.optimize`.
 *
 * Deleting a suggestion is not part of this service on purpose: a suggestion is a scan id with
 * node ids, and deleting them is `DiskService.planDelete` → `runDelete` like everywhere else
 * (block list, recycle bin by default, second confirmation checked natively).
 */

export type CleanupCategory = 'temp' | 'browserCache' | 'crashReports' | 'oldDownloads';
export type CleanupSource = '' | 'chrome' | 'edge' | 'brave' | 'firefox';

/** One clean-up place with what could go. */
export interface CleanupPlace {
  category: CleanupCategory;
  /** The browser of a cache; empty otherwise. */
  source: CleanupSource;
  /** The scan that holds this place (for `planDelete`). */
  scanId: number;
  path: string;
  /** The biggest suggested entries (preview; at most 200). */
  items: DiskNode[];
  /** Node ids of all suggested entries. */
  ids: number[];
  totalBytes: number;
  totalFiles: number;
  /** Ticked by default; never for the user's own downloads. */
  preselected: boolean;
  /** Only entries at least this old are suggested (0 = all). */
  minAgeDays: number;
  /** The program that uses these files is running. */
  busy: boolean;
}

export interface CleanupProgress {
  done: number;
  total: number;
  category: CleanupCategory;
}

export interface CleanupResult {
  places: CleanupPlace[];
  cancelled: boolean;
}

/** Windows' own tools the page may open (fixed list, checked natively). */
export type CareTool =
  | 'storageSettings'
  | 'diskCleanup'
  | 'recycleBin'
  | 'startupApps'
  | 'systemProtection'
  | 'optimizeDrives'
  | 'powerSettings';

export type CareKind = 'cleanup' | 'startup' | 'tweak';

/** One line of the history. Holds no file names or paths. */
export interface CareEntry {
  id: number;
  /** Unix seconds. */
  at: number;
  kind: CareKind;
  /** Clean-up: the category (or `scan`); otherwise the id of the setting or autostart entry. */
  subject: string;
  label: string;
  bytes: number;
  files: number;
  permanent: boolean;
  on: boolean | null;
  canUndo: boolean;
  undone: boolean;
  /** Changed elsewhere (in Windows itself) since: cannot be taken back here any more. */
  stale?: boolean;
}

export interface CareHistory {
  entries: CareEntry[];
  /** The history file was unreadable and a new one was started. */
  recovered: boolean;
  /**
   * The file with the stored changes cannot be read right now: only this session's clean-ups
   * are listed, and nothing can be changed or taken back until it can.
   */
  unreadable: boolean;
}

export type StartupScope = 'user' | 'machine';
export type StartupSource = 'run' | 'folder';

/** One program that starts with Windows. */
export interface StartupItem {
  /** Names the entry for `setStartup`; nothing else is ever sent back. */
  id: string;
  name: string;
  /** The command line, or the file name in the startup folder. For display only. */
  command: string;
  /** Best guess at the program (the executable's name without its ending); may be empty. */
  program: string;
  /** `machine`: starts for every account of the PC and is only shown. */
  scope: StartupScope;
  source: StartupSource;
  enabled: boolean;
  switchable: boolean;
}

export interface OptimizeService {
  /** The Windows-only parts exist here (tools; autostart and settings build on it). */
  windows: boolean;
  /**
   * Looks through the clean-up places (nothing is changed). A new search replaces the previous
   * one and its scan ids.
   */
  cleanupScan(onProgress: (p: CleanupProgress) => void): Promise<CleanupResult>;
  cancelCleanup(): Promise<void>;
  history(): Promise<CareHistory>;
  /**
   * Takes a change back (only where `canUndo`): the values from before are put in place again.
   * Rejects with `Error(code)`, e.g. `newer-change`, `already-undone`, `nothing-to-undo`.
   */
  undo(id: number): Promise<void>;
  /** Rejects with `Error('unsupported')` where the tool does not exist. */
  openTool(tool: CareTool): Promise<void>;
  /** What starts with Windows for this account. Rejects with `Error('unsupported')` elsewhere. */
  startupList(): Promise<StartupItem[]>;
  /**
   * Switches one of the user's own entries on or off (the way Task Manager does; the entry itself
   * stays). Resolves with the id of the history entry (for `undo`), or `null` when the entry
   * already was in that state. Rejects with `Error(code)`, e.g. `read-only`, `unknown-entry`.
   */
  setStartup(id: string, enabled: boolean): Promise<number | null>;
}

const unsupported = (): Promise<never> => Promise.reject(new Error('unsupported'));

/** Where there is no PC care (browser, phone). */
export const noOptimize: OptimizeService = {
  windows: false,
  cleanupScan: unsupported,
  cancelCleanup: unsupported,
  history: unsupported,
  undo: unsupported,
  openTool: unsupported,
  startupList: unsupported,
  setStartup: unsupported,
};
