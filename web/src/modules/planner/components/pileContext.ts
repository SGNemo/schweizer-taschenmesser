/**
 * What a pile row needs from the page (planner hub 2, package 2): the fold of the board's reading and the plan's things
 * by key. Provided once by the planner page; a row outside it (a test, the week band) simply has no pile data.
 */
import { createContext, useContext } from 'react';
import type { PlannableEntry } from '@/core/modules/contributions';
import { areaOfPileId, type Folded, type PileGroup } from '@/core/modules/pile';
import type { PileArea } from '@/core/modules/types';

export interface PileData {
  piles: Folded;
  entries: ReadonlyMap<string, PlannableEntry>;
  today: string;
  /** Members that are „Frist vorbei“ by the board's own rule (`lateMoneyDue`): P4 counts these. */
  lateKeys: ReadonlySet<string>;
}

export const PileContext = createContext<PileData | undefined>(undefined);

/** The pile behind a plan row, when the row is one (`planner:pile-<area>`). */
export function usePileOf(
  entry: Pick<PlannableEntry, 'moduleId' | 'id' | 'kind'> | undefined,
): { area: PileArea; group: PileGroup | undefined; data: PileData | undefined } | undefined {
  const data = useContext(PileContext);
  if (!entry || entry.moduleId !== 'planner' || entry.kind !== 'pile') return undefined;
  const area = areaOfPileId(entry.id);
  if (!area) return undefined;
  return { area, group: data?.piles.groups.get(area), data };
}
