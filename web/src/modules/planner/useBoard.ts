import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { getMeta } from '@/core/db/metaKv';
import {
  useCalendarItems,
  usePlanBlocks,
  usePlannable,
  type PlannableEntry,
} from '@/core/modules/contributions';
import { addDays } from '@/core/plan/dates';
import { useFocusSettings } from '@/core/settings/focus';
import { useSettings } from '@/core/settings/settings';
import { today } from '@/core/time/now';
import { PILE_AREAS, pileKey, type Folded } from '@/core/modules/pile';
import { buildBoard, type Board } from './board';
import { foldPlan, loadPileParts, pileAreas, pileUnasked } from './piles';
import type { PileArea } from '@/core/modules/types';
import { assignmentRepo, dayRepo, itemRepo } from './repo';
import { LAST_RUN_KEY, requestedIds, type LastRun } from './run';
import {
  DEFAULT_PLANNER_SETTINGS,
  PLANNER_SCOPE,
  plannerSettingsSchema,
  type PlannerSettings,
} from './settings';

export interface BoardData {
  board: Board;
  /** The collective rows of the switched-on areas (package 2): parts, folded members, counts. */
  piles: Folded;
  /** The plan's things by item key (`<module>:<id>`): a pile's member lines are read from them. */
  entries: ReadonlyMap<string, PlannableEntry>;
  /**
   * The offer P5 (package 2): an area never asked about whose things wait in „Noch ohne Tag“ – how many of them would
   * fold. Money before mail; the page shows it from 3 on, unless dismissed on this device.
   */
  pileOffer?: { area: PileArea; n: number };
  /** The days in view when they differ from the board's (package 4: a later week, the 4-week grid). */
  view?: Board['days'];
  settings: PlannerSettings;
  planLimit: number;
  last: LastRun | undefined;
  titles: Record<string, string>;
  today: string;
}

/**
 * Live data of the board for `span` days from today; `undefined` while loading. `view` = the days in view when they
 * are another stretch (a later week, the four weeks of the grid from a Monday that may have passed): built from the
 * same reads, the sources listed up to the last day in view.
 */
export function useBoard(
  span: number,
  view?: { from: string; span: number },
): BoardData | undefined {
  const day = today();
  const boardEnd = addDays(day, span - 1);
  const viewEnd = view ? addDays(view.from, view.span - 1) : boardEnd;
  const until = viewEnd > boardEnd ? viewEnd : boardEnd;
  const first = view && view.from < day ? view.from : day;
  const viewFrom = view?.from;
  const viewSpan = view?.span;
  const [stored] = useSettings(PLANNER_SCOPE, plannerSettingsSchema, DEFAULT_PLANNER_SETTINGS);
  const settings = stored ?? DEFAULT_PLANNER_SETTINGS;
  const [focus] = useFocusSettings();
  const calendar = useCalendarItems({ from: first, to: until });
  const blocks = usePlanBlocks({ today: day, until });
  const own = useLiveQuery(
    async () => ({
      dayRows: await dayRepo.active().toArray(),
      itemRows: await itemRepo.active().toArray(),
      assignments: await assignmentRepo.active().toArray(),
      last: (await getMeta<LastRun>(LAST_RUN_KEY)) ?? null,
    }),
    [],
  );
  // As the run reads them: a thing without a date shows only while its item row asks for it.
  const requested = useMemo(() => (own ? requestedIds(own.itemRows) : undefined), [own]);
  const entries = usePlannable({ today: day, until }, requested);
  // The parts of the switched-on piles (package 2): read live, like the things themselves.
  // Parts of the switched-on areas and of those never asked about (the offer counts what would fold).
  const areas = new Set([...pileAreas(settings), ...pileUnasked(settings)]);
  const areasKey = [...areas].join(',');
  const parts = useLiveQuery(
    () => loadPileParts({ today: day, until }, areas),
    // `areas` is read through its key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [day, until, areasKey],
  );
  return useMemo(() => {
    if (!own || !entries || !calendar || !blocks || !parts) return undefined;
    // What stands on its own is never folded: a placement row, „Nicht planen“.
    const placed = [
      ...own.assignments.map((a) => a.itemKey),
      ...own.itemRows.filter((r) => r.excluded).map((r) => r.id),
    ];
    const piles = foldPlan(parts, entries, pileAreas(settings), placed);
    const fold = {
      folded: new Set(piles.folded.keys()),
      idle: new Set(PILE_AREAS.filter((a) => !piles.groups.get(a)?.alive).map((a) => pileKey(a))),
    };
    const last = own.last ?? undefined;
    const titles: Record<string, string> = { ...last?.titles };
    for (const e of entries) titles[`${e.moduleId}:${e.id}`] = e.title;
    const board = buildBoard({
      today: day,
      span,
      settings,
      dayRows: own.dayRows,
      itemRows: own.itemRows,
      assignments: own.assignments,
      entries,
      calendar,
      blocks,
      unplaced: last?.unplaced ?? [],
      titles,
      piles: fold,
    });
    const shown =
      viewFrom !== undefined &&
      viewSpan !== undefined &&
      buildBoard({
        today: day,
        from: viewFrom,
        span: viewSpan,
        settings,
        dayRows: own.dayRows,
        itemRows: own.itemRows,
        assignments: own.assignments,
        entries,
        calendar,
        blocks,
        unplaced: [],
        titles,
        piles: fold,
      }).days;
    const unasked = pileUnasked(settings);
    const would = foldPlan(parts, entries, unasked, placed).folded;
    const offerArea = PILE_AREAS.find(
      (a) => unasked.has(a) && board.waiting.some((w) => would.get(w.itemKey) === a),
    );
    const pileOffer = offerArea
      ? {
          area: offerArea,
          n: board.waiting.filter((w) => would.get(w.itemKey) === offerArea).length,
        }
      : undefined;
    return {
      board,
      piles,
      ...(pileOffer ? { pileOffer } : {}),
      entries: new Map(entries.map((e) => [`${e.moduleId}:${e.id}`, e])),
      ...(shown ? { view: shown } : {}),
      settings,
      planLimit: focus.planLimit,
      last,
      titles,
      today: day,
    };
  }, [
    own,
    entries,
    calendar,
    blocks,
    parts,
    settings,
    focus.planLimit,
    day,
    span,
    viewFrom,
    viewSpan,
  ]);
}
