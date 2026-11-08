import { createCollectionRepo } from '@/core/db/repo';
import type { TaschenmesserDB } from '@/core/db/db';
import { loadModuleStates, type ModuleStates } from '@/core/modules/activation';
import type { ModuleManifest } from '@/core/modules/types';
import { getManifest, visibleManifests } from '@/core/modules/registry';
import { today } from '@/core/time/now';
import type { CaptureFields, CaptureType } from '../parser';
import { TARGETS } from './adapters';
import { CaptureError, type CaptureTarget, type CaptureVia, type SavedCapture } from './types';

export { CaptureError } from './types';
export type { CaptureRef, CaptureTarget, CaptureVia, SavedCapture } from './types';
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
  const on = (moduleId: string) => !!getManifest(moduleId) && !!states[moduleId];
  return (Object.keys(TARGETS) as (keyof typeof TARGETS)[]).filter((type) => {
    const target = TARGETS[type] as CaptureTarget;
    return on(target.moduleId) && (!target.via || on(targetFor(target.via.type).moduleId));
  });
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
  if (target.via) return saveTwoStage(target, target.via, manifest, fields, states, opts);

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

/**
 * A two-stage save (`CaptureVia`): the first record through its own target, then this target's record
 * under the deterministic id through the manifest repo (`upsert`). A failing second stage takes the
 * first record back; the undo removes both.
 */
async function saveTwoStage(
  target: CaptureTarget,
  via: CaptureVia,
  manifest: ModuleManifest,
  fields: CaptureFields,
  states: ModuleStates,
  opts: SaveOptions,
): Promise<SavedCapture> {
  const ctx = { today: today() };
  // Checked before anything is written: an unusable input leaves no half entry behind.
  target.build(fields, ctx);
  const first = await saveCapture(via.type, fields, { ...opts, states });
  const repo = createCollectionRepo(manifest, target.collection, opts.database);
  const id = via.id(first);
  try {
    await repo.upsert(id, target.build(fields, ctx, first));
  } catch {
    await first.undo();
    throw new CaptureError('invalid');
  }
  return {
    id: first.id,
    type: target.type,
    moduleId: first.moduleId,
    undo: async () => {
      await repo.remove(id);
      await first.undo();
    },
  };
}

/** One entry of a multi-line capture, already typed and parsed. */
export interface CaptureItem {
  type: CaptureType;
  fields: CaptureFields;
}

/**
 * Saves several entries as one batch: one after the other (so a new ToDo inbox is created once),
 * all or nothing (a failing entry removes the ones written before it). The result counts as one
 * saved capture whose `undo` takes every entry back.
 */
export async function saveCaptures(
  items: readonly CaptureItem[],
  text: string,
  opts: SaveOptions = {},
): Promise<SavedCapture> {
  if (items.length === 0) throw new CaptureError('invalid');
  const saved: SavedCapture[] = [];
  try {
    for (const item of items) saved.push(await saveCapture(item.type, item.fields, opts));
  } catch (e) {
    await Promise.allSettled(saved.map((s) => s.undo()));
    throw e;
  }
  const first = saved[0]!;
  return {
    id: first.id,
    type: first.type,
    moduleId: first.moduleId,
    count: saved.length,
    text,
    types: saved.map((s) => s.type),
    undo: async () => {
      await Promise.all(saved.map((s) => s.undo()));
    },
  };
}
