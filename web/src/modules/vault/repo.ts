import { deleteBlob, putBlob } from '@/core/blobs';
import { isLiveOrRestorable } from '@/core/db/trash';
import { trashRetentionMs } from '@/core/trash/settings';
import { now } from '@/core/time/now';
import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import type { ResolvedCategory } from './categories';
import {
  categorySchema,
  documentSchema,
  NO_CATEGORY,
  type DocCategory,
  type DocumentCategory,
  type VaultDocument,
} from './schema';

export const documentRepo = createRepo(tableName('vault', 'document'), documentSchema);
export const categoryRepo = createRepo(tableName('vault', 'category'), categorySchema);

/** Stores a document and (optionally) its file. The file is checked before anything is written. */
export async function saveDocument(
  id: string | null,
  data: VaultDocument,
  file?: File | 'remove',
): Promise<string> {
  // `expiresOn` is read-only legacy: an edit moves the value to `endDate`.
  const base: VaultDocument = {
    ...data,
    endDate: data.endDate ?? data.expiresOn,
    expiresOn: undefined,
  };
  const meta: VaultDocument =
    file instanceof File
      ? { ...base, fileName: file.name, fileType: file.type || undefined, fileSize: file.size }
      : file === 'remove'
        ? { ...base, fileName: undefined, fileType: undefined, fileSize: undefined }
        : base;
  const saved = id ? await documentRepo.update(id, meta) : await documentRepo.create(meta);
  if (file instanceof File) await putBlob(saved.id, file);
  else if (file === 'remove') await deleteBlob(saved.id);
  return saved.id;
}

/**
 * Deletes the record (a tombstone, so "Rückgängig" and "Zuletzt gelöscht" can bring it back). The
 * file stays on this device while the record can be restored; `restorableIds` decides what the
 * clean-up may remove.
 */
export async function deleteDocument(id: string): Promise<void> {
  await documentRepo.remove(id);
}

/** Ids whose files must be kept: active documents and ones deleted within the restore window. */
export async function keepBlobIds(at: number = now(), retentionMs?: number): Promise<Set<string>> {
  const window = retentionMs ?? (await trashRetentionMs());
  const all = await documentRepo.table.toArray();
  return new Set(all.filter((d) => isLiveOrRestorable(d.deletedAt, at, window)).map((d) => d.id));
}

/**
 * Writes a change to a category. A built-in one has no record until its first change: then the record starts from
 * what the page showed (colour, icon, place), so nothing else jumps. "Ohne Kategorie" is never written.
 */
export async function writeCategory(
  cat: Pick<ResolvedCategory, 'id' | 'tone' | 'icon' | 'order' | 'fixed'> & { name?: string },
  patch: Partial<DocumentCategory>,
): Promise<void> {
  if (cat.fixed || cat.id === NO_CATEGORY) return;
  const existing = await categoryRepo.table.get(cat.id);
  if (existing) {
    await categoryRepo.update(cat.id, patch);
    if (existing.deletedAt !== null) await categoryRepo.restore(cat.id);
    return;
  }
  await categoryRepo.upsert(cat.id, {
    ...(cat.name ? { name: cat.name } : {}),
    tone: cat.tone,
    icon: cat.icon,
    order: cat.order,
    ...patch,
  });
}

/** A new category; returns its id. */
export async function createCategory(data: DocumentCategory): Promise<string> {
  return (await categoryRepo.create(data)).id;
}

/**
 * Removes a category without losing a document: every document in it moves to `moveTo` first ("Ohne Kategorie"
 * unless another live category is chosen), only then is the category marked removed. Run it inside
 * `deleteWithUndo`: one "Rückgängig" brings the category and every document's place back.
 */
export async function removeCategory(
  cat: Pick<ResolvedCategory, 'id' | 'tone' | 'icon' | 'order' | 'fixed'> & { name?: string },
  docIds: readonly string[],
  moveTo: DocCategory = NO_CATEGORY,
): Promise<void> {
  if (cat.fixed || cat.id === NO_CATEGORY) throw new Error('"Ohne Kategorie" cannot be removed');
  const target = moveTo === cat.id ? NO_CATEGORY : moveTo;
  for (const id of docIds) await documentRepo.update(id, { category: target });
  await writeCategory(cat, { removed: true });
}
