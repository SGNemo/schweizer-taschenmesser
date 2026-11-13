import { useEffect, useRef } from 'react';
import { create } from 'zustand';

/**
 * The one entry point of a module page (Identity 4.0, rule 4): the page declares its action once (`PageAction` in the
 * `PageHeader`), the shell shows it where the device has its main action: on the desktop as the one filled button in
 * the head's title row, on the phone as the plus in the middle of the bottom bar (no button in the head, no floating
 * button over the content). Set while the page is mounted, cleared when it goes; nothing is stored.
 */
export interface PageActionState {
  /** The thing the action adds, as a short noun ("Buchung"): the plus shows it and is named "<noun> eintragen". */
  short: string;
  /** The plus's accessible name when "<noun> eintragen" reads wrong ("Neue Liste" for a thing one creates to write in); it contains `short`. */
  name?: string;
  run: () => void;
  disabled: boolean;
}

export const usePageActionStore = create<{
  action: PageActionState | undefined;
  set: (action: PageActionState | undefined) => void;
}>((set) => ({ action: undefined, set: (action) => set({ action }) }));

/** Declares the page's action for as long as the caller is mounted (`enabled` false: declares nothing). */
export function usePageAction(
  action: { short: string; name?: string; onClick: () => void; disabled?: boolean },
  enabled = true,
): void {
  const set = usePageActionStore((s) => s.set);
  // The latest handler without re-registering on every render of the page.
  const handler = useRef(action.onClick);
  useEffect(() => {
    handler.current = action.onClick;
  });
  const { short, name } = action;
  const disabled = action.disabled ?? false;
  useEffect(() => {
    if (!enabled) return;
    const mine: PageActionState = { short, name, disabled, run: () => handler.current() };
    set(mine);
    return () => {
      // Only clear what is still ours: the next page may already have declared its own.
      if (usePageActionStore.getState().action === mine) set(undefined);
    };
  }, [set, enabled, short, name, disabled]);
}
