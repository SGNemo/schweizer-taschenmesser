import { useLiveQuery } from 'dexie-react-hooks';
import { z } from 'zod';
import { createRepo } from '@/core/db/repo';
import { ENVELOPE_KEYS } from '@/core/db/types';
import { sameValue } from './changed';

/** One record per scope ("core", "module.<id>", "dashboard"); values are top-level fields. */
export const settingsRepo = createRepo('_settings', z.looseObject({}));

const envelope = new Set<string>(ENVELOPE_KEYS);

function valuesOf(row: Record<string, unknown> | undefined): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row ?? {}).filter(([k]) => !envelope.has(k)));
}

export async function getSettings<S extends z.ZodObject>(
  scope: string,
  schema: S,
  defaults: z.input<S>,
): Promise<z.output<S>> {
  const row = await settingsRepo.get(scope);
  const parsed = schema.safeParse({ ...defaults, ...valuesOf(row) });
  return parsed.success ? parsed.data : schema.parse(defaults);
}

type ChangeListener = (scope: string, key: string, before: unknown, after: unknown) => void;
let changeListener: ChangeListener | undefined;

/** The one observer of settings writes (the change history, `history.ts`); kept as a seam so this file imports nothing from it. */
export function setChangeListener(fn: ChangeListener | undefined): void {
  changeListener = fn;
}

/**
 * Writes the given keys of a scope. `defaults` (when the caller knows them) say what a key held
 * before its first write, so the change history can offer to take it back.
 */
export function setSettings(
  scope: string,
  patch: Record<string, unknown>,
  defaults?: Readonly<Record<string, unknown>>,
): Promise<void> {
  return inOrder(scope, () => writeSettings(scope, patch, defaults));
}

/** Tail of the running patches per scope; a scope leaves the map once its last patch is done. */
const pending = new Map<string, Promise<unknown>>();

/**
 * Runs the patches of one scope one after the other. Each patch reads, merges and writes the whole
 * row, so two patches started together would read the same row and the later write would drop the
 * earlier change. A queue instead of a Dexie transaction: the repo write already opens its own
 * transaction after awaiting the device context, which must not happen inside an outer one.
 */
function inOrder(scope: string, run: () => Promise<void>): Promise<void> {
  const before = pending.get(scope) ?? Promise.resolve();
  const mine = before.then(run, run);
  const tail = mine.catch(() => undefined);
  pending.set(scope, tail);
  void tail.then(() => {
    if (pending.get(scope) === tail) pending.delete(scope);
  });
  return mine;
}

async function writeSettings(
  scope: string,
  patch: Record<string, unknown>,
  defaults?: Readonly<Record<string, unknown>>,
): Promise<void> {
  const row = await settingsRepo.get(scope);
  const old = valuesOf(row);
  await settingsRepo.upsert(scope, { ...old, ...patch });
  if (!changeListener) return;
  for (const [key, after] of Object.entries(patch)) {
    const before = key in old ? old[key] : defaults?.[key];
    if (before !== undefined && !sameValue(before, after))
      changeListener(scope, key, before, after);
  }
}

/** Live settings values plus a patch function. `undefined` until first read. */
export function useSettings<S extends z.ZodObject>(scope: string, schema: S, defaults: z.input<S>) {
  const values = useLiveQuery(() => getSettings(scope, schema, defaults), [scope]);
  return [
    values,
    (patch: Partial<z.input<S>>) => setSettings(scope, patch, defaults as Record<string, unknown>),
  ] as const;
}
