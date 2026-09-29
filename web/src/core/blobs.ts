/**
 * Local binary storage (documents). Files live in the device-local `_blobs` table: they are not
 * part of the field-operation sync protocol and not exported to the JSON backup.
 * Data is kept as ArrayBuffer (structured-clone safe everywhere) and turned into a Blob on read.
 */
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';

interface BlobRow {
  key: string;
  type: string;
  data: ArrayBuffer;
}

const table = (database: TaschenmesserDB) => database.table<BlobRow, string>('_blobs');

export async function putBlob(
  key: string,
  file: Blob,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  await table(database).put({ key, type: file.type, data: await file.arrayBuffer() });
}

export async function getBlob(
  key: string,
  database: TaschenmesserDB = defaultDb,
): Promise<Blob | undefined> {
  const row = await table(database).get(key);
  return row ? new Blob([row.data], { type: row.type }) : undefined;
}

export const deleteBlob = (key: string, database: TaschenmesserDB = defaultDb): Promise<void> =>
  table(database).delete(key);

export const blobKeys = (database: TaschenmesserDB = defaultDb): Promise<string[]> =>
  table(database).toCollection().primaryKeys();

/** Removes files whose key is not in `keep` (e.g. documents deleted on another device). */
export async function pruneBlobs(
  keep: ReadonlySet<string>,
  database: TaschenmesserDB = defaultDb,
): Promise<number> {
  const orphans = (await blobKeys(database)).filter((k) => !keep.has(k));
  await table(database).bulkDelete(orphans);
  return orphans.length;
}
