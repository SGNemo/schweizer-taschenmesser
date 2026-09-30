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
    await table.put({ key: SETUP_STATE_KEY, value: next });
    return next;
  });
}

/** Marks progress on the first change so an app that is closed mid-way offers to resume. */
const started = (s: SetupState): SetupStatus =>
  s.status === 'notStarted' ? 'inProgress' : s.status;

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
    }),
    database,
  );

/** "Später fortsetzen": keeps all progress. */
export const pauseSetup = (database?: TaschenmesserDB) =>
  updateSetupState(
    (s) => (s.status === 'completed' ? s : { ...s, status: 'inProgress' }),
    database,
  );

/** "Einrichtung beenden": progress stays, the rest lives on in the checklist. */
export const dismissSetup = (database?: TaschenmesserDB) =>
  updateSetupState((s) => (s.status === 'completed' ? s : { ...s, status: 'dismissed' }), database);

export const completeSetup = (database?: TaschenmesserDB) =>
  updateSetupState((s) => ({ ...s, status: 'completed', version: SETUP_VERSION }), database);

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
