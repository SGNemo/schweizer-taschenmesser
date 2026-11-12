/** What "Tab neu öffnen" on the start view would open. */
export interface ReopenTarget {
  url: string;
  title: string;
}

/**
 * The page the start view offers to open again, or `null` for no offer:
 * the tab closed last in this session; else, only while no page is open in any tab (the state after a restart) and
 * the history is on, the last page of the history. Never inside a private tab: it would load a normal page there.
 */
export function reopenTarget(input: {
  lastClosed: ReopenTarget | null;
  /** The active tab is a private one. */
  inPrivateTab: boolean;
  /** A page is open in some tab. */
  anyOpen: boolean;
  historyOn: boolean;
  /** Newest entry of the history. */
  lastVisit: ReopenTarget | undefined;
}): ReopenTarget | null {
  if (input.inPrivateTab) return null;
  if (input.lastClosed) return input.lastClosed;
  if (!input.historyOn || input.anyOpen || !input.lastVisit) return null;
  return { url: input.lastVisit.url, title: input.lastVisit.title };
}
