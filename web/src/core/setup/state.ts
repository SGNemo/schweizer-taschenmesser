/**
 * Setup progress. Device-local (`_meta`, key `setup.state`): never synced, never in a backup.
 * It holds step ids only – no values, no secrets.
 */
import { z } from 'zod';
import { rwTransaction } from '@/core/db/tx';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { SETUP_VERSION } from './types';

export const SETUP_STATE_KEY = 'setup.state';

export const SETUP_STATUSES = ['notStarted', 'inProgress', 'dismissed', 'completed'] as const;
export type SetupStatus = (typeof SETUP_STATUSES)[number];

export const setupStateSchema = z.strictObject({
  status: z.enum(SETUP_STATUSES),
  doneSteps: z.array(z.string()),
  skippedSteps: z.array(z.string()),
  /** `SETUP_VERSION` the user last went through; newer steps are offered afterwards. */
  version: z.number().int().min(0),
  lastStep: z.string().optional(),
  /** The step that was on screen at "Später fortsetzen"; "Fortsetzen" opens exactly there. */
  pausedAt: z.string().optional(),
  /** The pause happened in the first-run questions, so they continue as questions. */
  pausedQuick: z.boolean().optional(),
  checklistHidden: z.boolean(),
});
export type SetupState = z.infer<typeof setupStateSchema>;

export function initialState(status: SetupStatus = 'notStarted'): SetupState {
  return {
    status,
    doneSteps: [],
    skippedSteps: [],
    version: SETUP_VERSION,
    checklistHidden: false,
  };
}

const meta = (database: TaschenmesserDB) =>
  database.table<{ key: string; value: unknown }, string>('_meta');

/** `null` when never written (or unreadable – then the migration writes a fresh one). */
export async function readSetupState(
  database: TaschenmesserDB = defaultDb,
): Promise<SetupState | null> {
  const row = await meta(database).get(SETUP_STATE_KEY);
  const parsed = setupStateSchema.safeParse(row?.value);
  return parsed.success ? parsed.data : null;
}

/**
 * Read-modify-write in one transaction, so every change of progress is atomic. Only Dexie calls
 * happen inside (`update` is synchronous).
 */
export async function updateSetupState(
  update: (state: SetupState) => SetupState,
  database: TaschenmesserDB = defaultDb,
): Promise<SetupState> {
  const table = meta(database);
  return rwTransaction(database, [table], async () => {
    const current = (await readSetupState(database)) ?? initialState();
    const next = setupStateSchema.parse(update(current));
    // A cleared pause leaves no empty keys behind: the row holds only what is set.
    for (const key of Object.keys(next) as (keyof SetupState)[])
      if (next[key] === undefined) delete next[key];
    await table.put({ key: SETUP_STATE_KEY, value: next });
    return next;
  });
}

/** Marks progress on the first change so an app that is closed mid-way offers to resume. */
const started = (s: SetupState): SetupStatus =>
  s.status === 'notStarted' ? 'inProgress' : s.status;

/** Answering a step (or finishing, ending) ends the remembered pause. */
const unpaused = { pausedAt: undefined, pausedQuick: undefined };

const without = (list: string[], id: string) => list.filter((x) => x !== id);
const withId = (list: string[], id: string) => (list.includes(id) ? list : [...list, id]);

export const markStepDone = (id: string, database?: TaschenmesserDB) =>
  updateSetupState(
    (s) => ({
      ...s,
      status: started(s),
      doneSteps: withId(s.doneSteps, id),
      skippedSteps: without(s.skippedSteps, id),
      lastStep: id,
      ...unpaused,
    }),
    database,
  );

export const markStepSkipped = (id: string, database?: TaschenmesserDB) =>
  updateSetupState(
    (s) => ({
      ...s,
      status: started(s),
      skippedSteps: withId(s.skippedSteps, id),
      doneSteps: without(s.doneSteps, id),
      lastStep: id,
      ...unpaused,
    }),
    database,
  );

/** "Später fortsetzen": keeps all progress and remembers the step on screen (ids only). */
export const pauseSetup = (database?: TaschenmesserDB, at?: { step: string; quick: boolean }) =>
  updateSetupState(
    (s) =>
      s.status === 'completed'
        ? s
        : {
            ...s,
            status: 'inProgress',
            ...(at ? { pausedAt: at.step, pausedQuick: at.quick } : unpaused),
          },
    database,
  );

/** "Einrichtung beenden": progress stays, the rest lives on in the checklist. */
export const dismissSetup = (database?: TaschenmesserDB) =>
  updateSetupState(
    (s) => (s.status === 'completed' ? s : { ...s, status: 'dismissed', ...unpaused }),
    database,
  );

export const completeSetup = (database?: TaschenmesserDB) =>
  updateSetupState(
    (s) => ({ ...s, status: 'completed', version: SETUP_VERSION, ...unpaused }),
    database,
  );

export const setChecklistHidden = (hidden: boolean, database?: TaschenmesserDB) =>
  updateSetupState((s) => ({ ...s, checklistHidden: hidden }), database);

export interface StepLike {
  id: string;
  since: number;
}
export type StepProgress = 'done' | 'skipped' | 'open';

export function stepProgress(state: SetupState, id: string, autoDone = false): StepProgress {
  if (state.doneSteps.includes(id) || autoDone) return 'done';
  return state.skippedSteps.includes(id) ? 'skipped' : 'open';
}

/** Steps introduced after the version the user last completed. */
export function newSteps<T extends StepLike>(steps: readonly T[], state: SetupState): T[] {
  return steps.filter((s) => s.since > state.version && !state.doneSteps.includes(s.id));
}

/** First step that is neither done nor skipped, or `undefined` when everything was handled. */
export function resumeStep<T extends StepLike>(
  steps: readonly T[],
  state: SetupState,
): T | undefined {
  return steps.find((s) => stepProgress(state, s.id) === 'open');
}

/**
 * Where "Fortsetzen" opens: the step that was on screen at the pause while it is still open (in the
 * questions when it was paused there), else the first open step.
 */
export function resumeTarget<T extends StepLike>(
  steps: readonly T[],
  state: SetupState,
): { step: T; quick: boolean } | undefined {
  const paused = state.pausedAt ? steps.find((s) => s.id === state.pausedAt) : undefined;
  if (paused && stepProgress(state, paused.id) === 'open')
    return { step: paused, quick: state.pausedQuick === true };
  const first = resumeStep(steps, state);
  return first ? { step: first, quick: false } : undefined;
}

/**
 * What "Weiter" records. Done only when the step wrote something (or its default is the answer);
 * a step that merely was looked at stays on the checklist as skipped ("Später").
 */
export function continueOutcome(
  step: { settledByContinue?: boolean },
  committed: boolean,
  result: void | 'skipped',
): 'done' | 'skipped' {
  if (result === 'skipped') return 'skipped';
  return committed || step.settledByContinue ? 'done' : 'skipped';
}

/** Steps that count in "x von y" – hints are shown but never counted. One number everywhere. */
export function countedSteps<T extends { hint?: boolean }>(steps: readonly T[]): T[] {
  return steps.filter((s) => !s.hint);
}
