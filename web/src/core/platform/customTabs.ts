/**
 * Android only: opens an http(s) address in a Chrome Custom Tab (`src-tauri/plugins/custom-tabs`).
 * The page runs in the system browser's process with its own cookies and settings; Nemo injects
 * nothing into it and gets nothing back, so tabs, find, zoom and ad blocking are the system's.
 */
export interface CustomTabsService {
  supported: boolean;
  /** Rejects when the address is not http(s) or no browser can show it. */
  open(url: string): Promise<void>;
}
