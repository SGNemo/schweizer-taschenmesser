import { createContext, useContext, useEffect } from 'react';

/** The wizard listens here: true while the step on screen shows its own primary button. */
export const StepPrimaryContext = createContext<((owns: boolean) => void) | undefined>(undefined);

/**
 * One primary per view (U59, UI round 6): while a step's own button is the next thing to do (notifications: "Erlauben"
 * before the question is answered), the wizard's "Weiter" steps back to a secondary button; it is primary again once
 * `owns` turns false or the step leaves the screen.
 */
export function useStepOwnsPrimary(owns: boolean): void {
  const set = useContext(StepPrimaryContext);
  useEffect(() => {
    set?.(owns);
    return () => set?.(false);
  }, [set, owns]);
}
