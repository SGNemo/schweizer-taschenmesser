/**
 * Whether rows say Z1 „· wie zuletzt“ (package 8): the switch „Aus gemessener Zeit vorschlagen“, provided by the planner
 * page. Off, a measured length reads as plain minutes (its records and Z2 stay). Outside the page: shown.
 */
import { createContext, useContext } from 'react';
import type { PlanItemRow } from '../schema';

export const MeasureShown = createContext(true);

/** The row's minutes came from measured time and still stand (`PlanItemRow.measured`). */
export function useMeasured(item: PlanItemRow | undefined, minutes: number): boolean {
  const shown = useContext(MeasureShown);
  return shown && item?.measured === true && item.durationMin === minutes;
}
