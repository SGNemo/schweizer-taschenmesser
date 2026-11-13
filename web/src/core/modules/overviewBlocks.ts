import { createContext, useContext } from 'react';
import type { AttentionCover } from './types';

/**
 * Which block of the overview lists single things right now (`home/attentionFold.ts`, `activeCovers`): `'agenda'` =
 * "Heute · Morgen · diese Woche", `'today'` = the "Heute" card itself names the day's appointments. The strip reads the
 * same value, so nothing stands on the overview twice. `undefined` outside the overview and while editing.
 */
export const OverviewBlocksContext = createContext<readonly AttentionCover[] | undefined>(
  undefined,
);

export const useOverviewBlocks = (): readonly AttentionCover[] | undefined =>
  useContext(OverviewBlocksContext);
