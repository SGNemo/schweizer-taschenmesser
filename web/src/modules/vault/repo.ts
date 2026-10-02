import { deleteBlob, putBlob } from '@/core/blobs';
import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { documentSchema, type VaultDocument } from './schema';

export const documentRepo = createRepo(tableName('vault', 'document'), documentSchema);

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

export async function deleteDocument(id: string): Promise<void> {
  await documentRepo.remove(id);
  await deleteBlob(id);
}
