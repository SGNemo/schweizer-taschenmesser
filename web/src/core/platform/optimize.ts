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
}

export interface CareHistory {
  entries: CareEntry[];
  /** The history file was unreadable and a new one was started. */
  recovered: boolean;
}

export type TweakGroup = 'appearance' | 'explorer' | 'privacy' | 'power';
export type TweakRisk = 'none' | 'low';

/** One option of a choice (a power plan of this PC, named by Windows). */
export interface TweakOption {
  id: string;
  label: string;
}

/** One Windows setting of the catalogue with its state on this PC. Texts are keyed by `id`. */
export interface TweakState {
  id: string;
  group: TweakGroup;
  kind: 'toggle' | 'choice';
  /** A switch: its state; `null` = Windows' own default applies (no value set yet). */
  on: boolean | null;
  /** A choice: the id of the active option. */
  choice: string | null;
  options: TweakOption[];
  /** Changed from this page: the state from before is stored. */
  changedHere: boolean;
  /** Exists on this Windows; the page hides the others. */
  applicable: boolean;
  risk: TweakRisk;
  /** The Microsoft page that documents the mechanism. */
  sourceUrl: string;
  /** `explorer`: open Explorer windows show it after a refresh. */
  refresh: 'none' | 'explorer';
}

/** Outcome of "Alle zurücksetzen": setting ids. */
export interface TweakReset {
  restored: string[];
  failed: string[];
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
  /** The catalogue of Windows settings with their state (Windows only). */
  tweaks(): Promise<TweakState[]>;
  /**
   * Switches a setting (`true`/`false`, or the id of a choice). The state from before is stored
   * first and the change appears in `history()` with `canUndo`. Rejects with `Error(code)`.
   */
  setTweak(id: string, target: boolean | string): Promise<void>;
  /** Puts every setting changed here back to the state from before its first change. */
  resetTweaks(): Promise<TweakReset>;
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
  tweaks: unsupported,
  setTweak: unsupported,
  resetTweaks: unsupported,
};
