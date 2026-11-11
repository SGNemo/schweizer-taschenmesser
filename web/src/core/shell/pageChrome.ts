import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * What a page asks of the shell around it (focus audit 2): a page with a "⋯" menu carries the "Mit KI eintragen"
 * entry and the "Erweitert" switch there. Set while the page is mounted, reset when it goes away; nothing is stored.
 * (The round "+" button and its `hideFab` wish are gone with Identity 4.0: the page's action is `core/shell/pageAction`.)
 */
export interface PageChrome {
  /** The page's own menu holds "Mit KI eintragen". */
  writeInMenu: boolean;
  /** The page's own menu holds the "Erweitert" switch: the page header does not repeat it. */
  advancedInMenu: boolean;
}

const NONE: PageChrome = { writeInMenu: false, advancedInMenu: false };

export const usePageChromeStore = create<{ chrome: PageChrome; set: (c: PageChrome) => void }>(
  (set) => ({ chrome: NONE, set: (chrome) => set({ chrome }) }),
);

/** Declares the page's wishes for as long as it is mounted. */
export function usePageChrome(chrome: Partial<PageChrome>): void {
  const set = usePageChromeStore((s) => s.set);
  const writeInMenu = chrome.writeInMenu ?? false;
  const advancedInMenu = chrome.advancedInMenu ?? false;
  useEffect(() => {
    set({ writeInMenu, advancedInMenu });
    return () => set(NONE);
  }, [set, writeInMenu, advancedInMenu]);
}
