import { createCollectionRepo } from '@/core/db/repo';
import type { TaschenmesserDB } from '@/core/db/db';
import { loadModuleStates, type ModuleStates } from '@/core/modules/activation';
import { getManifest, visibleManifests } from '@/core/modules/registry';
import { today } from '@/core/time/now';
import type { CaptureFields, CaptureType } from '../parser';
import { TARGETS } from './adapters';
import { CaptureError, type CaptureTarget, type SavedCapture } from './types';

export { CaptureError } from './types';
export type { CaptureTarget, SavedCapture } from './types';
export { TARGETS } from './adapters';

export interface SaveOptions {
  database?: TaschenmesserDB;
  /** Overrides the module states read from the database (tests). */
  states?: ModuleStates;
  /** Finance drafts need `true` here; callers pass it only after the user confirmed. */
  confirmed?: boolean;
}

/** Target types whose module is currently enabled and installed, in a stable UI order. */
export function availableTypes(states: ModuleStates | undefined): CaptureType[] {
  if (!states) return [];
  return (Object.keys(TARGETS) as (keyof typeof TARGETS)[]).filter(
    (type) => !!getManifest(TARGETS[type].moduleId) && states[TARGETS[type].moduleId],
  );
}

export function targetFor(type: CaptureType): CaptureTarget {
  const target = TARGETS[type as keyof typeof TARGETS];
  if (!target) throw new CaptureError('unknown-target');
  return target;
}

/**
 * Writes one captured entry into its module. Only active modules are written to, always through
 * `createRepo` (validation, HLC stamps, outbox), never through module code.
 */
export async function saveCapture(
  type: CaptureType,
  fields: CaptureFields,
  opts: SaveOptions = {},
): Promise<SavedCapture> {
  const target = targetFor(type);
  const manifest = getManifest(target.moduleId);
  const states = opts.states ?? (await loadModuleStates(visibleManifests, opts.database));
  if (!manifest || !states[target.moduleId]) {
    throw new CaptureError('module-off', manifest?.name ?? target.moduleId);
  }
  if (target.requiresConfirm && !opts.confirmed) throw new CaptureError('invalid');

  const data = target.build(fields, { today: today() });
  const load = manifest.contributions?.aiCreateDefaults;
  if (load) {
    const defaults = await (await load()).default(target.collection);
    for (const [k, v] of Object.entries(defaults)) if (!(k in data)) data[k] = v;
  }

  const repo = createCollectionRepo(manifest, target.collection, opts.database);
  let saved;
  try {
    saved = await repo.create(data);
  } catch {
    // Zod rejected the record (e.g. an impossible date); never echo user text into the error.
    throw new CaptureError('invalid');
  }
  return {
    id: saved.id,
    type,
    moduleId: target.moduleId,
    undo: () => repo.remove(saved.id),
  };
}
