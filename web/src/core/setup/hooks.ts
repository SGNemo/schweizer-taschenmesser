import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef } from 'react';
import { readSetupState, type SetupState } from './state';

/** Live setup state: `undefined` while loading, `null` before the start migration ran. */
export function useSetupState(): SetupState | null | undefined {
  return useLiveQuery(() => readSetupState(), []);
}

/**
 * Makes the Android back gesture / browser back close an overlay instead of leaving the page:
 * one history entry is pushed while `active`, and popping it calls `onBack`. Closing the overlay
 * by other means removes the entry again. The router's own history state is copied so its
 * bookkeeping stays intact.
 *
 * An overlay that unmounts hands its entry to one that mounts in the same render (the app remounts
 * on a language switch with the dialog still open); only an entry nobody took over is removed. An
 * immediate `history.back()` would arrive after the new overlay pushed its own entry and close it.
 */
let handedOver = 0;

export function useBackClose(active: boolean, onBack: () => void): void {
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  });
  useEffect(() => {
    if (!active) return;
    if (handedOver > 0) handedOver--;
    else window.history.pushState({ ...(window.history.state as object), tmOverlay: true }, '');
    const onPop = () => {
      // Re-arm so a cancelled close ("Weiter einrichten") keeps back working.
      window.history.pushState({ ...(window.history.state as object), tmOverlay: true }, '');
      onBackRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      handedOver++;
      setTimeout(() => {
        if (handedOver === 0) return; // taken over by the overlay mounted in the same render
        handedOver--;
        if ((window.history.state as { tmOverlay?: boolean } | null)?.tmOverlay) {
          window.history.back();
        }
      }, 0);
    };
  }, [active]);
}
