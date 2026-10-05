/**
 * Writes confirmed ops. Each module gets one batch in `_imports` (origin `assistant`, shared
 * `groupId`), so undo, the "recently imported" list and the conflict rules of the importer apply
 * unchanged: an entry edited since the preview is skipped and counted, never overwritten.
 */
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { commitImport, newBatchId, undoImport } from '@/core/importer/batches';
import type { ImportBatch, ImportCandidate, PreviewRow } from '@/core/importer/types';
import type { AiActionHandler, ModuleManifest } from '@/core/modules/types';
import { now } from '@/core/time/now';
import type { PreparedOp } from './types';

export const ASSISTANT_IMPORTER_ID = 'assistant';

async function handlersOf(manifest: ModuleManifest): Promise<Record<string, AiActionHandler>> {
  const load = manifest.contributions?.aiActionHandlers;
  return load ? (await load()).default : {};
}

function candidateOf(op: PreparedOp, def: { via?: string }): ImportCandidate {
  const label = op.targetTitle ?? String(op.data[titleKey(op)] ?? op.actionLabel);
  const base = { collection: op.collection, label, dedupeKey: `${op.action}:${label}` };
  if (op.kind === 'create') return { ...base, data: op.data };
  if (op.kind === 'delete') {
    return { ...base, id: op.targetId, data: {}, remove: { before: op.before ?? {} } };
  }
  return {
    ...base,
    id: op.targetId,
    data: {},
    update: {
      before: op.before ?? {},
      after: op.data,
      lines: op.lines.map((l) => ({ field: l.field, from: l.from ?? '', to: l.to ?? '' })),
      ...(def.via ? { via: def.via } : {}),
    },
  };
}

const titleKey = (op: PreparedOp): string =>
  ['title', 'name', 'payee'].find((k) => k in op.data) ?? 'title';

export interface CommitResult {
  groupId: string;
  batches: ImportBatch[];
  /** Entries skipped because they changed after the preview. */
  conflicts: number;
  written: number;
}

/** Commits the ticked, ready ops. Throws nothing for skipped ones; the preview never offers them. */
export async function commitOps(
  ops: readonly PreparedOp[],
  deps: { manifests: readonly ModuleManifest[]; source: string; database?: TaschenmesserDB },
): Promise<CommitResult> {
  const database = deps.database ?? defaultDb;
  const groupId = newBatchId();
  const byModule = new Map<string, PreparedOp[]>();
  for (const op of ops.filter((o) => o.ready)) {
    byModule.set(op.module, [...(byModule.get(op.module) ?? []), op]);
  }
  const batches: ImportBatch[] = [];
  for (const [moduleId, list] of byModule) {
    const manifest = deps.manifests.find((m) => m.id === moduleId);
    if (!manifest) continue;
    const handlers = await handlersOf(manifest);
    const rows: PreviewRow[] = list.map((op, index) => {
      const via = op.kind === 'transition' && handlers[op.action] ? op.action : undefined;
      return { index, candidate: candidateOf(op, { via }), duplicate: false, selected: true };
    });
    batches.push(
      await commitImport(
        manifest,
        {
          batchId: newBatchId(),
          importerId: ASSISTANT_IMPORTER_ID,
          source: deps.source.slice(0, 120),
          rows,
          base: { origin: 'assistant', groupId, createdAt: now() },
          handlers,
        },
        database,
      ),
    );
  }
  return {
    groupId,
    batches,
    conflicts: batches.reduce((n, b) => n + (b.conflicts ?? 0), 0),
    written: batches.reduce(
      (n, b) =>
        n +
        b.records.reduce((m, r) => m + r.ids.length, 0) +
        (b.updates?.length ?? 0) +
        (b.deletes?.length ?? 0),
      0,
    ),
  };
}

/** Undoes everything one confirmation wrote (all modules). */
export async function undoGroup(
  groupId: string,
  deps: { manifests: readonly ModuleManifest[]; database?: TaschenmesserDB },
): Promise<{ removed: number; kept: number }> {
  const database = deps.database ?? defaultDb;
  const all = await database.table<ImportBatch, string>('_imports').toArray();
  let removed = 0;
  let kept = 0;
  for (const batch of all.filter((b) => b.groupId === groupId)) {
    const manifest = deps.manifests.find((m) => m.id === batch.moduleId);
    if (!manifest) continue;
    const r = await undoImport(manifest, batch.id, database, await handlersOf(manifest));
    removed += r.removed;
    kept += r.kept;
  }
  return { removed, kept };
}
