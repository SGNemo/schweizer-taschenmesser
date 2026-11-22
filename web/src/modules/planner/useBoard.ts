import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { getMeta } from '@/core/db/metaKv';
import { useCalendarItems, usePlanBlocks, usePlannable } from '@/core/modules/contributions';
import { addDays } from '@/core/plan/dates';
import { useFocusSettings } from '@/core/settings/focus';
import { useSettings } from '@/core/settings/settings';
import { today } from '@/core/time/now';
import { buildBoard, type Board } from './board';
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
  return useMemo(() => {
    if (!own || !entries || !calendar || !blocks) return undefined;
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
      }).days;
    return {
      board,
      ...(shown ? { view: shown } : {}),
      settings,
      planLimit: focus.planLimit,
      last,
      titles,
      today: day,
    };
  }, [own, entries, calendar, blocks, settings, focus.planLimit, day, span, viewFrom, viewSpan]);
}
