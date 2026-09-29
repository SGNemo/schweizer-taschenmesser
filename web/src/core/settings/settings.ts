import { useLiveQuery } from 'dexie-react-hooks';
import { z } from 'zod';
import { createRepo } from '@/core/db/repo';
import { ENVELOPE_KEYS } from '@/core/db/types';

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

export async function setSettings(scope: string, patch: Record<string, unknown>): Promise<void> {
  const row = await settingsRepo.get(scope);
  await settingsRepo.upsert(scope, { ...valuesOf(row), ...patch });
}

/** Live settings values plus a patch function. `undefined` until first read. */
export function useSettings<S extends z.ZodObject>(scope: string, schema: S, defaults: z.input<S>) {
  const values = useLiveQuery(() => getSettings(scope, schema, defaults), [scope]);
  return [values, (patch: Partial<z.input<S>>) => setSettings(scope, patch)] as const;
}
