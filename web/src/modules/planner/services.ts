/**
 * Runs the planner while the module is enabled (CONCEPT §2 "Runs and write-back"):
 *  - a live query over the inputs (the sources' things, the timed calendar items, the own tables, the
 *    settings, the module states) starts a background run whenever something changed – not through
 *    `core/db/writeHook` (that one listener belongs to the automation engine and never sees sync-applied
 *    writes). A sync-applied change of the assignment rows is a change too: the run then rewrites only
 *    the rows that differ.
 *  - user actions from the planner UI run inside one `undoable` together with their run and write-backs
 *    (`runUser`); every other run is background: serialised behind any open user action, not undoable.
 *  - `module.disabling` for the planner stops the runs and hands every planner-own date back to its
 *    source (both policies), before the state is written and before any wipe.
 */
import { liveQuery } from 'dexie';
import { logError } from '@/core/diagnostics/logError';
import { readMeta } from '@/core/db/meta';
import { bus } from '@/core/events';
import { loadModuleStates } from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import {
  activeManifests,
  collectCalendarItems,
  collectPlannable,
} from '@/core/modules/contributions';
import type { ModuleManifest } from '@/core/modules/types';
import { addDays } from '@/core/plan/dates';
import { getFocusSettings } from '@/core/settings/focus';
import { settingsRepo } from '@/core/settings/settings';
import { syncSettled } from '@/core/sync/service';
import { today } from '@/core/time/now';
import { undoable, type UndoEntry } from '@/core/undo';
import { assignmentRepo, dayRepo, itemRepo, MODULE_ID } from './repo';
import { LAST_RUN_KEY, restoreSources, runPlanner, type RunDeps, type RunOutcome } from './run';
import { getPlannerSettings } from './prefs';
import { PLANNER_SCOPE } from './settings';

let chain: Promise<unknown> = Promise.resolve();
let stopped = false;
/** Set while the service is started (tests call `runUser` without one). */
let manifestsFor: (() => Promise<readonly ModuleManifest[]>) | undefined;

const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
};

/** Every run waits for the runs queued before it (tests). */
export const runsSettled = (): Promise<unknown> => chain;

async function activeSources(): Promise<readonly ModuleManifest[]> {
  if (manifestsFor) return manifestsFor();
  return activeManifests(await loadModuleStates());
}

async function depsNow(): Promise<RunDeps> {
  const [settings, focus, manifests, settled] = await Promise.all([
    getPlannerSettings(),
    getFocusSettings(),
    activeSources(),
    syncSettled(),
  ]);
  return { today: today(), manifests, settings, planLimit: focus.planLimit, settled };
}

/** A background run: serialised, not undoable, skipped while nothing changed or the module is stopping. */
export function runBackground(): Promise<RunOutcome | undefined> {
  return enqueue(async () => {
    if (stopped) return undefined;
    const deps = await depsNow();
    if (!deps.settings.autoReplan) return undefined;
    return runPlanner(deps);
  });
}

export interface UserRun {
  outcome: RunOutcome;
  entry?: UndoEntry;
}

/**
 * A user action of the planner UI: `act` and the run it causes (write-backs included) are one undoable
 * action, so the toast's „Rückgängig“ restores everything. Returns the run and the undo entry.
 */
export function runUser(label: string, act: () => Promise<void>): Promise<UserRun> {
  return enqueue(async () => {
    const { result, entry } = await undoable(label, async () => {
      await act();
      return runPlanner(await depsNow(), { force: true });
    });
    return { outcome: result, ...(entry ? { entry } : {}) };
  });
}

/** Everything a run reads, as one string: the live query re-emits when any of it changes. */
async function inputSnapshot(): Promise<string> {
  const states = await loadModuleStates();
  const manifests = activeManifests(states);
  const settings = await getPlannerSettings();
  const day = today();
  const until = addDays(day, Number(settings.horizonDays) - 1);
  const [things, calendar, days, items, assignments, focus, last] = await Promise.all([
    collectPlannable({ today: day, until }, manifests),
    settings.calendarBlocks ? collectCalendarItems({ from: day, to: until }, manifests) : [],
    dayRepo.active().toArray(),
    itemRepo.active().toArray(),
    assignmentRepo.active().toArray(),
    settingsRepo.get('focus'),
    readMeta(LAST_RUN_KEY),
  ]);
  void settingsRepo.get(PLANNER_SCOPE); // tracked read, so a settings change re-emits
  return JSON.stringify([
    day,
    things,
    calendar.filter((c) => c.source !== 'planner'),
    days,
    items,
    assignments,
    settings,
    focus?.planLimit,
    last,
  ]);
}

/** Loads the lazy sources once, so the live query's first run only awaits cached imports (keeps Dexie's tracking). */
async function preload(): Promise<void> {
  const manifests = activeManifests(await loadModuleStates());
  await Promise.all(
    manifests.flatMap((m) => [m.contributions?.plannable?.(), m.contributions?.calendarItems?.()]),
  );
}

export default function start(): () => void {
  stopped = false;
  manifestsFor = undefined;
  let sub: { unsubscribe(): void } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void runBackground().catch(logError('planner.run')), 50);
  };
  void preload()
    .catch(() => undefined)
    .then(() => {
      if (stopped) return;
      sub = liveQuery(inputSnapshot).subscribe({
        next: schedule,
        error: (e) => console.error('[planner] input stream failed', e),
      });
    });
  const offDisabling = bus.on('module.disabling', async ({ moduleId }) => {
    if (moduleId !== MODULE_ID) return;
    stopped = true;
    clearTimeout(timer);
    sub?.unsubscribe();
    await chain;
    await restoreSources({ today: today(), manifests: availableManifests() });
  });
  return () => {
    stopped = true;
    clearTimeout(timer);
    sub?.unsubscribe();
    offDisabling();
  };
}

/** Tests: run against fixed sources instead of the module states. */
export function setManifestsForTests(
  fn: (() => Promise<readonly ModuleManifest[]>) | undefined,
): void {
  manifestsFor = fn;
  stopped = false;
}
