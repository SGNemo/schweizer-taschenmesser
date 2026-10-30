import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * What a page asks of the shell around it (focus audit 2): a page that has its own add field does
 * not need the round "+" button, and a page with a "⋯" menu carries the "Mit KI eintragen" entry
 * there instead of a second button in the area header. Set while the page is mounted, reset when
 * it goes away; nothing is stored.
 */
export interface PageChrome {
  /** The page has an add field: the shell hides the round quick-add button. */
  hideFab: boolean;
  /** The page's own menu holds "Mit KI eintragen": the area header does not repeat it. */
  writeInMenu: boolean;
}

const NONE: PageChrome = { hideFab: false, writeInMenu: false };

export const usePageChromeStore = create<{ chrome: PageChrome; set: (c: PageChrome) => void }>(
  (set) => ({ chrome: NONE, set: (chrome) => set({ chrome }) }),
);

/** Declares the page's wishes for as long as it is mounted. */
export function usePageChrome(chrome: Partial<PageChrome>): void {
  const set = usePageChromeStore((s) => s.set);
  const hideFab = chrome.hideFab ?? false;
  const writeInMenu = chrome.writeInMenu ?? false;
  useEffect(() => {
    set({ hideFab, writeInMenu });
    return () => set(NONE);
  }, [set, hideFab, writeInMenu]);
}
