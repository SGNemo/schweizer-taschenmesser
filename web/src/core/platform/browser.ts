/**
 * Contract of the built-in browser's native side (`src-tauri/src/browser.rs`, desktop only).
 * A tab is a separate child webview with its own data store and NO access to Nemo: it has no IPC,
 * no Nemo data and gets no script from us. The Nemo page only gives it bounds and an address and
 * listens to its events.
 */

export interface BrowserBounds {
  /** CSS pixels relative to the Nemo window's content area. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export type BrowserEvent =
  | { event: 'url'; tab: number; url: string }
  | { event: 'title'; tab: number; title: string }
  | { event: 'loading'; tab: number; loading: boolean }
  /** A plain-HTTP address was held back; the page shows the warning and may call `navigate(..., true)`. */
  | { event: 'httpHeld'; tab: number; url: string }
  /** A page tried to open a pop-up; nothing opened. */
  | { event: 'popupBlocked'; tab: number; url: string }
  /** The page started a download; the webview did not save it, the address goes to the Downloads module. */
  | { event: 'download'; tab: number; url: string }
  /** A request was stopped by the blocker (`host` = where it went). */
  | { event: 'blocked'; tab: number; host: string }
  /** A third-party host the page talked to (for "Blocker" panel). */
  | { event: 'seen'; tab: number; host: string };

export interface BlockerConfig {
  enabled: boolean;
  /** User rules, same shape as Rust `Rule`. */
  rules: Array<{ kind: 'domain' | 'address'; value: string }>;
  /** Sites where the user paused the blocker. */
  pausedHosts: string[];
}

export interface BrowserOpenOptions {
  tab: number;
  url: string;
  bounds: BrowserBounds;
  /** Private tab: no stored cookies/cache after closing, no history. */
  privateTab: boolean;
  zoom: number;
}

export interface BrowserService {
  supported: boolean;
  /** Create the tab's webview. Events arrive until `close`. */
  open(options: BrowserOpenOptions, onEvent: (event: BrowserEvent) => void): Promise<void>;
  /** `allowHttp` = the user chose "Trotzdem öffnen" for this plain-HTTP address. */
  navigate(tab: number, url: string, allowHttp?: boolean): Promise<void>;
  back(tab: number): Promise<void>;
  forward(tab: number): Promise<void>;
  reload(tab: number): Promise<void>;
  close(tab: number): Promise<void>;
  /** Show this tab (and hide all others); `null` hides every tab (e.g. while a Nemo dialog is open). */
  show(tab: number | null, bounds?: BrowserBounds): Promise<void>;
  setZoom(tab: number, factor: number): Promise<void>;
  setBlocker(config: BlockerConfig): Promise<void>;
  /** Close every tab and delete cookies, cache and site data of the browser (not of Nemo). */
  clearData(): Promise<void>;
}
