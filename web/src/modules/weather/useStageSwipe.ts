import { useEffect, useRef } from 'react';

/** Limits of the swipe on the picture (CONCEPT-DAYS §3). */
export const SWIPE_EDGE_PX = 24;
export const SWIPE_MIN_PX = 56;
export const SWIPE_RATIO = 2;

/**
 * True for a horizontal swipe that steps a day: started at `x0` (not within 24 px of the screen edges, where the
 * system's back gesture lives), at least 56 px sideways and twice as much sideways as vertical. Pure.
 */
export function swipeStep(x0: number, dx: number, dy: number, width: number): -1 | 1 | 0 {
  if (x0 < SWIPE_EDGE_PX || x0 > width - SWIPE_EDGE_PX) return 0;
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < SWIPE_RATIO * Math.abs(dy)) return 0;
  // Left = the next day.
  return dx < 0 ? 1 : -1;
}

/** Controls inside the stage keep their own gestures (links, buttons, the module row). */
const OWN = 'a, button, input, select, textarea, nav, [role="tablist"], [role="group"]';

/**
 * A horizontal swipe on the weather picture steps one day (phone; CONCEPT-DAYS §3). It starts only inside the stage
 * (`[data-testid="module-frame"]`); it is never the only way – the stepper does the same.
 */
export function useStageSwipe(enabled: boolean, onStep: (dir: -1 | 1) => void): void {
  const step = useRef(onStep);
  useEffect(() => {
    step.current = onStep;
  }, [onStep]);
  useEffect(() => {
    if (!enabled) return;
    let start: { x: number; y: number } | null = null;
    const down = (e: TouchEvent) => {
      const t = e.touches[0];
      const target = e.target instanceof Element ? e.target : null;
      const stage = target?.closest('[data-testid="module-frame"]');
      start =
        t && e.touches.length === 1 && stage && !target?.closest(OWN)
          ? { x: t.clientX, y: t.clientY }
          : null;
    };
    const up = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (!start || !t) return;
      const dir = swipeStep(start.x, t.clientX - start.x, t.clientY - start.y, window.innerWidth);
      start = null;
      if (dir) step.current(dir);
    };
    const cancel = () => {
      start = null;
    };
    document.addEventListener('touchstart', down, { passive: true });
    document.addEventListener('touchend', up, { passive: true });
    document.addEventListener('touchcancel', cancel, { passive: true });
    return () => {
      document.removeEventListener('touchstart', down);
      document.removeEventListener('touchend', up);
      document.removeEventListener('touchcancel', cancel);
    };
  }, [enabled]);
}
