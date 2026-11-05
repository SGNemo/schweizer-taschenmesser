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
import { deleteMeta, getMeta } from '@/core/db/metaKv';
import { bus } from '@/core/events';
import { loadModuleStates, loadStoredModuleState } from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import {
  activeManifests,
  collectCalendarItems,
  collectPlannable,
} from '@/core/modules/contributions';
import type { ModuleManifest } from '@/core/modules/types';
import { addDays } from '@/core/plan/dates';
import { getFocusSettings } from '@/core/settings/focus';
import { PULL_COMPLETE_KEY } from '@/core/storage/dexie';
import { LAST_SYNC_KEY, syncSettled } from '@/core/sync/service';
import { now, today } from '@/core/time/now';
import { forgetUndo, undoable, type UndoEntry } from '@/core/undo';
import { assignmentRepo, dayRepo, itemRepo, MODULE_ID } from './repo';
import { LAST_RUN_KEY, restoreSources, runPlanner, type RunDeps, type RunOutcome } from './run';
import { getPlannerSettings } from './prefs';

let chain: Promise<unknown> = Promise.resolve();
let stopped = false;
/** Bumped by every `start()`: a run from an earlier life of the service writes nothing more. */
let generation = 0;
/** Set while the test data is removed (`suspendRuns`/`resumeRuns`): background runs skip. */
let suspended = false;

/** `runUser` while the module is switched off (a stale page in another tab): the UI says so, calmly. */
export class PlannerOffError extends Error {
  constructor() {
    super('planner: switched off');
    this.name = 'PlannerOffError';
  }
}
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

/** `wait`: a background run lets a running sync round end first; a user action never waits. */
async function depsNow(wait: boolean): Promise<RunDeps> {
  const gen = generation;
  const [settings, focus, manifests, settled] = await Promise.all([
    getPlannerSettings(),
    getFocusSettings(),
    activeSources(),
    syncSettled(undefined, { wait }),
  ]);
  return {
    today: today(),
    manifests,
    settings,
    planLimit: focus.planLimit,
    settled,
    aborted: () => stopped || generation !== gen,
  };
}

/** Switched off meanwhile (this tab, another tab, another device)? Then no run may touch the rows again. */
async function switchedOff(): Promise<boolean> {
  if (stopped) return true;
  const stored = await loadStoredModuleState(MODULE_ID);
  return stored !== undefined && !stored.enabled;
}

/**
 * A background run: serialised, not undoable, skipped while nothing changed or the module is off.
 * `force` (the seed's first run) plans even when nothing changed and `autoReplan` is off.
 */
export function runBackground(opts: { force?: boolean } = {}): Promise<RunOutcome | undefined> {
  return enqueue(async () => {
    if ((suspended && !opts.force) || (await switchedOff())) return undefined;
    const deps = await depsNow(true);
    if (!deps.settings.autoReplan && !opts.force) return undefined;
    return runPlanner(deps, opts);
  });
}

/** The seed's removal: no background run until `resumeRuns`; resolves when the running one is done. */
export async function suspendRuns(): Promise<void> {
  suspended = true;
  await chain;
}

/** … and one run afterwards, so the rows follow what is left. */
export function resumeRuns(): void {
  suspended = false;
  void runBackground().catch(logError('planner.run'));
}

export interface UserRun {
  outcome: RunOutcome;
  entry?: UndoEntry;
}

/**
 * A user action of the planner UI: `act` and the run it causes (write-backs included) are one undoable
 * action, so the undo in the toast restores everything. Returns the run and the undo entry.
 */
export function runUser(label: string, act: () => Promise<void>): Promise<UserRun> {
  return enqueue(async () => {
    if (await switchedOff()) throw new PlannerOffError();
    const { result, entry } = await undoable(
      label,
      async () => {
        await act();
        return runPlanner(await depsNow(false), { force: true });
      },
      MODULE_ID,
    );
    return { outcome: result, ...(entry ? { entry } : {}) };
  });
}

/**
 * Everything a run reads, as one string: the live query re-emits when any of it changes. The sync
 * gate is part of it (the pull flag and the last round's time), so a run that was gated while a sync
 * ran is tried again when the round ends. The stored `LastRun` is left out: the run writes it.
 */
async function inputSnapshot(): Promise<string> {
  const states = await loadModuleStates();
  const manifests = activeManifests(states);
  const settings = await getPlannerSettings();
  const day = today();
  const until = addDays(day, Number(settings.horizonDays) - 1);
  const [things, calendar, days, items, assignments, focus, pull, lastSync] = await Promise.all([
    collectPlannable({ today: day, until }, manifests),
    settings.calendarBlocks ? collectCalendarItems({ from: day, to: until }, manifests) : [],
    dayRepo.active().toArray(),
    itemRepo.active().toArray(),
    assignmentRepo.active().toArray(),
    getFocusSettings(),
    getMeta(PULL_COMPLETE_KEY),
    getMeta(LAST_SYNC_KEY),
  ]);
  return JSON.stringify([
    day,
    things,
    calendar.filter((c) => c.source !== 'planner'),
    days,
    items,
    assignments,
    settings,
    focus.planLimit,
    pull,
    lastSync,
  ]);
}

/** Milliseconds from `at` to the next local midnight (plus a second, so `today()` has turned). */
export function msUntilNextDay(at: number): number {
  const d = new Date(at);
  d.setHours(24, 0, 1, 0);
  return Math.max(1000, d.getTime() - at);
}

/** How long the disabling handler waits for a running run before it hands the dates back anyway. */
export const DISABLE_WAIT_MS = 5000;

/** Loads the lazy sources once, so the live query's first run only awaits cached imports (keeps Dexie's tracking). */
async function preload(): Promise<void> {
  const manifests = activeManifests(await loadModuleStates());
  await Promise.all(
    manifests.flatMap((m) => [m.contributions?.plannable?.(), m.contributions?.calendarItems?.()]),
  );
}

export default function start(): () => void {
  stopped = false;
  generation++;
  manifestsFor = undefined;
  let active = true;
  let sub: { unsubscribe(): void } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let midnight: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void runBackground().catch(logError('planner.run')), 50);
  };
  // The day changes while the app is open: yesterday's leftovers must be carried without a write.
  const armMidnight = () => {
    clearTimeout(midnight);
    midnight = setTimeout(() => {
      schedule();
      armMidnight();
    }, msUntilNextDay(now()));
  };
  const onVisible = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') schedule();
  };
  void preload()
    .catch(() => undefined)
    .then(() => {
      if (!active) return;
      sub = liveQuery(inputSnapshot).subscribe({
        next: schedule,
        error: (e) => console.error('[planner] input stream failed', e),
      });
      armMidnight();
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
    });
  const offDisabling = bus.on('module.disabling', async ({ moduleId, policy }) => {
    if (moduleId !== MODULE_ID) return;
    stopped = true;
    active = false;
    clearTimeout(timer);
    clearTimeout(midnight);
    sub?.unsubscribe();
    // The planner's undo entries must not be replayed into a module that is off.
    forgetUndo(MODULE_ID);
    // A hung run must not keep the switch-off waiting: `stopped` makes it write nothing more (`RunDeps.aborted`).
    let wait: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([chain, new Promise((r) => (wait = setTimeout(r, DISABLE_WAIT_MS)))]);
    clearTimeout(wait);
    await restoreSources({ today: today(), manifests: availableManifests() });
    if (policy === 'delete') await deleteMeta(LAST_RUN_KEY);
  });
  return () => {
    stopped = true;
    active = false;
    forgetUndo(MODULE_ID);
    clearTimeout(timer);
    clearTimeout(midnight);
    sub?.unsubscribe();
    if (typeof document !== 'undefined')
      document.removeEventListener('visibilitychange', onVisible);
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
