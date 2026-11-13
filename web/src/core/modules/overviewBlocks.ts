import { createContext, useContext } from 'react';
import type { AttentionCover } from './types';

/**
 * The blocks of the overview that are on the page beside the widgets right now (`'agenda'` = "Heute · Morgen ·
 * diese Woche"). A widget reads it to leave out what such a block already lists, so nothing stands on the overview
 * twice. `undefined` outside the overview.
 */
export const OverviewBlocksContext = createContext<readonly AttentionCover[] | undefined>(
  undefined,
);

export const useOverviewBlocks = (): readonly AttentionCover[] | undefined =>
  useContext(OverviewBlocksContext);
