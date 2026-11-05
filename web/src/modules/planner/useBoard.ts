import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { readMeta } from '@/core/db/meta';
import { useCalendarItems, usePlannable } from '@/core/modules/contributions';
import { addDays } from '@/core/plan/dates';
import { useFocusSettings } from '@/core/settings/focus';
import { useSettings } from '@/core/settings/settings';
import { today } from '@/core/time/now';
import { buildBoard, type Board } from './board';
import { assignmentRepo, dayRepo, itemRepo } from './repo';
import { LAST_RUN_KEY, type LastRun } from './run';
import {
  DEFAULT_PLANNER_SETTINGS,
  PLANNER_SCOPE,
  plannerSettingsSchema,
  type PlannerSettings,
} from './settings';

export interface BoardData {
  board: Board;
  settings: PlannerSettings;
  planLimit: number;
  last: LastRun | undefined;
  titles: Record<string, string>;
  today: string;
}

/** Live data of the board for `span` days from today; `undefined` while loading. */
export function useBoard(span: number): BoardData | undefined {
  const day = today();
  const until = addDays(day, span - 1);
  const [stored] = useSettings(PLANNER_SCOPE, plannerSettingsSchema, DEFAULT_PLANNER_SETTINGS);
  const settings = stored ?? DEFAULT_PLANNER_SETTINGS;
  const [focus] = useFocusSettings();
  const entries = usePlannable({ today: day, until });
  const calendar = useCalendarItems({ from: day, to: until });
  const own = useLiveQuery(
    async () => ({
      dayRows: await dayRepo.active().toArray(),
      itemRows: await itemRepo.active().toArray(),
      assignments: await assignmentRepo.active().toArray(),
      last: (await readMeta<LastRun>(LAST_RUN_KEY)) ?? null,
    }),
    [],
  );
  return useMemo(() => {
    if (!own || !entries || !calendar) return undefined;
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
      unplaced: last?.unplaced ?? [],
      titles,
    });
    return { board, settings, planLimit: focus.planLimit, last, titles, today: day };
  }, [own, entries, calendar, settings, focus.planLimit, day, span]);
}
