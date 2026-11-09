/**
 * The room the module head's figure took on the last visit, per module and device (U01, UI round 6): on the next load
 * the frame keeps exactly that room while the page reads its data, so a page with a figure does not grow and a page
 * without one (an empty module) does not shrink. A per-viewer convenience in `localStorage`: missing or blocked storage
 * only means the frame falls back to the head variant's default shape.
 */
const KEY = 'tm-head-figure:';

/** Height in rem from the last visit; `0` = the page showed no figure; `undefined` = not known yet. */
export function readFigureRoom(moduleId: string): number | undefined {
  try {
    const raw = localStorage.getItem(KEY + moduleId);
    if (raw === null) return undefined;
    const rem = Number(raw);
    return Number.isFinite(rem) && rem >= 0 && rem < 40 ? rem : undefined;
  } catch {
    return undefined;
  }
}

export function writeFigureRoom(moduleId: string, rem: number): void {
  try {
    localStorage.setItem(KEY + moduleId, String(Math.round(rem * 100) / 100));
  } catch {
    // storage blocked: the next load uses the default shape
  }
}
