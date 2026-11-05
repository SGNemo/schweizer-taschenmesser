/** Preview step: validate candidates with the collection's real schema and flag duplicates. */
import type { ModuleManifest } from '@/core/modules/types';
import type { ImportCandidate, ImporterRuntime, PreviewRow } from './types';

export class ImportError extends Error {
  constructor(readonly code: 'unknown-collection' | 'nothing-selected') {
    super(code);
  }
}

function issueText(error: { issues: { path: PropertyKey[]; message: string }[] }): string {
  const first = error.issues[0];
  if (!first) return 'invalid';
  const path = first.path.map(String).join('.');
  return path ? `${path}: ${first.message}` : first.message;
}

/**
 * Rows for the preview. Invalid rows and duplicates start unticked; everything else is ticked
 * (the user confirms explicitly before anything is stored).
 */
export async function buildPreview(
  manifest: ModuleManifest,
  runtime: ImporterRuntime,
  candidates: ImportCandidate[],
): Promise<PreviewRow[]> {
  const existing = new Map<string, Set<string>>();
  for (const collection of new Set(candidates.filter((c) => !c.error).map((c) => c.collection))) {
    if (!(collection in manifest.dataSchema.collections))
      throw new ImportError('unknown-collection');
    existing.set(collection, await runtime.existingKeys(collection));
  }
  const seen = new Set<string>();
  const rows = candidates.map((candidate, index) => {
    const key = `${candidate.collection}\u0000${candidate.dedupeKey}`;
    // A change without any difference counts as "already there"; changes are never pre-ticked.
    const duplicate = candidate.update
      ? Object.keys(candidate.update.after).length === 0 || seen.has(key)
      : (existing.get(candidate.collection)?.has(candidate.dedupeKey) ?? false) || seen.has(key);
    seen.add(key);
    const schema = manifest.dataSchema.collections[candidate.collection]?.schema;
    const parsed = schema?.safeParse(candidate.data);
    const invalid =
      candidate.error ?? (parsed && !parsed.success ? issueText(parsed.error) : undefined);
    return {
      index,
      candidate,
      duplicate,
      invalid,
      selected: !duplicate && !invalid && !candidate.update,
    };
  });
  // A row whose partner (`dependsOn`) is out starts unticked too: on its own it would point at nothing.
  for (let changed = true; changed;) {
    changed = false;
    const on = new Set(rows.filter((r) => r.selected).map((r) => r.candidate.id));
    for (const r of rows) {
      if (r.selected && r.candidate.dependsOn && !on.has(r.candidate.dependsOn)) {
        r.selected = false;
        changed = true;
      }
    }
  }
  return rows;
}
