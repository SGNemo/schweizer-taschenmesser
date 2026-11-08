import { createCollectionRepo, type Repo } from '@/core/db/repo';
import type { TaschenmesserDB } from '@/core/db/db';
import { loadModuleStates, type ModuleStates } from '@/core/modules/activation';
import type { ModuleManifest } from '@/core/modules/types';
import { getManifest, visibleManifests } from '@/core/modules/registry';
import { today } from '@/core/time/now';
import type { CaptureFields, CaptureType } from '../parser';
import { TARGETS } from './adapters';
import {
  CaptureError,
  type CaptureRef,
  type CaptureTarget,
  type CaptureVia,
  type OpenInvoice,
  type SavedCapture,
} from './types';

export { CaptureError } from './types';
export type { CaptureRef, CaptureTarget, CaptureVia, OpenInvoice, SavedCapture } from './types';
// `findOpenInvoice` lives in `./lookup` and is loaded on demand (only reminder lines need it).
export type { InvoiceLookup } from './lookup';
export { TARGETS } from './adapters';

export interface SaveOptions {
  database?: TaschenmesserDB;
  /** Overrides the module states read from the database (tests). */
  states?: ModuleStates;
  /** Finance drafts need `true` here; callers pass it only after the user confirmed. */
  confirmed?: boolean;
  /**
   * Create-if-absent under this id (deterministic, see `captureId`): written through `createMany`, so an
   * existing record – live or tombstone – is never overwritten or revived; the result says `existed`.
   * An undo or a batch rollback leaves a tombstone under the id like any delete: saving the same thing
   * again then reports `'tombstone'`, and `reinstateCapture` is the way back.
   */
  id?: string;
}

const noop = async (): Promise<void> => undefined;

/**
 * A short deterministic id from its parts (SHA-256, hex, 16 characters): the same parts give the same
 * id on every device, so a second save of the same thing finds the first instead of doubling it.
 */
export async function captureId(parts: readonly string[]): Promise<string> {
  const bytes = new TextEncoder().encode(parts.join('\u0000'));
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(hash.slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Writes `data` under a fixed id only when nothing has that id yet. `createMany` skips an existing id
 * (tombstones too) without saying so, hence the second read to tell live from deleted.
 */
async function createIfAbsent(
  repo: Repo<Record<string, unknown>>,
  id: string,
  data: Record<string, unknown>,
): Promise<{ written: true } | { written: false; existed: true | 'tombstone' }> {
  let rows;
  try {
    rows = await repo.createMany([{ data, id }]);
  } catch {
    throw new CaptureError('invalid');
  }
  if (rows.length > 0) return { written: true };
  const row = await repo.table.get(id);
  // Skipped but not there at all (a race with a purge): nothing to point at, never „Wieder einplanen“.
  if (!row) throw new CaptureError('invalid');
  return { written: false, existed: row.deletedAt === null ? true : 'tombstone' };
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
  if (opts.id) {
    const done = await createIfAbsent(repo, opts.id, data);
    if (!done.written)
      return { id: opts.id, type, moduleId: target.moduleId, existed: done.existed, undo: noop };
    return { id: opts.id, type, moduleId: target.moduleId, undo: () => repo.remove(opts.id!) };
  }
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
  // An entry that was already there stops both stages: its plan row is not written again.
  if (first.existed) return { ...first, type: target.type };
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
  /** Create-if-absent under this id (one per entry, never one id for the whole batch). */
  id?: string;
  /** Note this entry on an existing record instead (a reminder on its open invoice, `amend`). */
  amend?: OpenInvoice;
  /** Saved instead when `amend` finds the record gone or settled since the preview. */
  fallback?: { type: CaptureType; fields: CaptureFields };
}

/** Repo of a target's collection, for the module that must be on. */
async function targetRepo(type: CaptureType, opts: SaveOptions) {
  const target = targetFor(type);
  const manifest = getManifest(target.moduleId);
  const states = opts.states ?? (await loadModuleStates(visibleManifests, opts.database));
  if (!manifest || !states[target.moduleId]) {
    throw new CaptureError('module-off', manifest?.name ?? target.moduleId);
  }
  return { target, repo: createCollectionRepo(manifest, target.collection, opts.database) };
}

/**
 * Notes a captured line on an existing record (`CaptureTarget.amend`): a payment reminder raises its
 * open invoice instead of creating a second one. Throws `CaptureError('stale')` when the record is
 * gone or settled since the preview.
 */
export async function amendCapture(
  type: CaptureType,
  fields: CaptureFields,
  match: OpenInvoice,
  opts: SaveOptions = {},
): Promise<SavedCapture> {
  const { target, repo } = await targetRepo(type, opts);
  if (!target.amend) throw new CaptureError('invalid');
  return target.amend(fields, match, { today: today(), repo });
}

/**
 * Brings back an entry saved under a fixed id and deleted since („Wieder einplanen“): the record and,
 * for a two-stage target, its second record `via.id(first)` – through `restore`, never `create`. The
 * undo deletes both again.
 */
export async function reinstateCapture(
  type: CaptureType,
  id: string,
  opts: SaveOptions = {},
): Promise<SavedCapture> {
  const target = targetFor(type);
  const all: { repo: Repo<Record<string, unknown>>; id: string }[] = [];
  if (target.via) {
    const first = await targetRepo(target.via.type, opts);
    const ref: CaptureRef = { moduleId: first.target.moduleId, id };
    all.push(
      { repo: first.repo, id },
      { repo: (await targetRepo(type, opts)).repo, id: target.via.id(ref) },
    );
  } else {
    all.push({ repo: (await targetRepo(type, opts)).repo, id });
  }
  // Only what is deleted now comes back, and only that is deleted again by the undo.
  const rows = await Promise.all(all.map((s) => s.repo.table.get(s.id)));
  const stages = all.filter((_, i) => rows[i] && rows[i]!.deletedAt !== null);
  // A stage missing: a half entry (a ToDo without its plan row) is never brought back.
  if (rows.some((r) => !r)) throw new CaptureError('invalid');
  // All or nothing: a failing second restore takes the first back (never half an entry).
  const done: typeof stages = [];
  try {
    for (const stage of stages) {
      await stage.repo.restore(stage.id);
      done.push(stage);
    }
  } catch (e) {
    const undone = await Promise.allSettled(done.reverse().map((st) => st.repo.remove(st.id)));
    // A failed take-back is said, never hidden: the caller must not assume nothing is live.
    if (undone.some((u) => u.status === 'rejected')) throw new CaptureError('invalid');
    throw e;
  }
  return {
    id,
    type,
    moduleId: target.via ? targetFor(target.via.type).moduleId : target.moduleId,
    undo: async () => {
      for (const stage of [...stages].reverse()) await stage.repo.remove(stage.id);
    },
  };
}

/**
 * Saves one entry as planned: noted on its record (`amend`), or – when that record was settled since
 * the preview – its fallback; everything else through `saveCapture`. Used by the batch and the sheet.
 */
export async function saveItem(item: CaptureItem, opts: SaveOptions = {}): Promise<SavedCapture> {
  if (item.amend) {
    try {
      return await amendCapture(item.type, item.fields, item.amend, opts);
    } catch (e) {
      if (!(e instanceof CaptureError && e.code === 'stale') || !item.fallback) throw e;
      return saveCapture(item.fallback.type, item.fallback.fields, opts);
    }
  }
  return saveCapture(item.type, item.fields, { ...opts, id: item.id });
}

/**
 * Saves several entries as one batch: one after the other (so a new ToDo inbox is created once),
 * all or nothing (a failing entry takes back the ones written before it). The result counts as one
 * saved capture whose `undo` takes every written entry back. An entry whose id already existed is
 * skipped by both (it was not written by this batch) and not counted. A batch never books money: it
 * never passes `confirmed`, so a booking in it fails the whole batch (decisions/features.md, „Kopf
 * leer“ Q1 a); the sheet turns money lines into ToDos before it gets here.
 */
export async function saveCaptures(
  items: readonly CaptureItem[],
  text: string,
  opts: Omit<SaveOptions, 'confirmed' | 'id'> = {},
): Promise<SavedCapture> {
  if (items.length === 0) throw new CaptureError('invalid');
  const saved: SavedCapture[] = [];
  const batch: SaveOptions = { ...opts, confirmed: false };
  try {
    for (const item of items) saved.push(await saveItem(item, batch));
  } catch (e) {
    await Promise.allSettled(saved.map((s) => s.undo()));
    throw e;
  }
  const written = saved.filter((s) => !s.existed);
  const first = written[0] ?? saved[0]!;
  return {
    id: first.id,
    type: first.type,
    moduleId: first.moduleId,
    count: written.length,
    text,
    types: written.map((s) => s.type),
    undo: async () => {
      await Promise.all(written.map((s) => s.undo()));
    },
  };
}
