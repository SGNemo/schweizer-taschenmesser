/**
 * Copy of the links a ToDo stores in its `links[]` field into the link table (CONCEPT-LINKS §1.3). The field
 * and its schema stay as they are (frozen; today's writers and older apps keep writing it) – this only makes
 * each entry readable from its other end.
 *
 * Every entry becomes the row `todos:<taskId> → <target>`, `origin`, under its deterministic id. Two rules keep
 * a copy from beating a removal:
 *  - **Only when absent:** an id that has a row on this device – live or tombstone – is skipped.
 *  - **Stamped like its source:** a copied row is not written "now" but with the HLC of the task's `links` field
 *    (every field, `deletedAt` too) through the sync-apply path (`writeStamped`), as app migrations copy. So
 *    every device writes identical ops, and a removal made anywhere after that array was written wins over the
 *    copy – also when this device has not pulled it yet. That is why the copy needs no completed pull first.
 *
 * When it runs: at every app start (not awaited), after a sync round that moved something and after a restore.
 * Runs are serialised. Never inside a Dexie upgrade: hashing is no Dexie operation.
 */
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { getManifest } from '@/core/modules/registry';
import { addLink } from './index';
import { carrierStamp, linkId, linksRepo, toRow, writeStamped, type LinkRow } from './store';
import { fromLegacy, LINK_KINDS, type EntityLink, type LegacyLink } from './types';

const isLegacy = (l: unknown): l is LegacyLink => {
  const link = l as Partial<LegacyLink> | null;
  return (
    typeof link === 'object' &&
    link !== null &&
    LINK_KINDS.includes(link.kind as LegacyLink['kind']) &&
    typeof link.id === 'string' &&
    link.id !== '' &&
    typeof link.label === 'string'
  );
};

/** The link a stored ToDo entry stands for. */
export const todoLink = (taskId: string, link: LegacyLink): EntityLink => ({
  from: { module: 'todos', id: taskId },
  ...fromLegacy(link),
});

/**
 * Copies every `links[]` entry of every live task that has no row yet. Returns how many rows were written.
 * `revive` is for a „replace“ restore of a backup from before the link table: the backup is the truth again, so
 * a row the restore just tombstoned comes back (like a tap, stamped now).
 */
export async function copyTodoLinks(
  database: TaschenmesserDB = defaultDb,
  opts: { revive?: boolean } = {},
): Promise<number> {
  const todos = getManifest('todos');
  if (!todos?.dataSchema.collections.task) return 0;
  const tasks = await createCollectionRepo(todos, 'task', database)
    .active()
    .filter((t) => Array.isArray(t.links) && t.links.length > 0)
    .toArray();
  const wanted = new Map<string, { data: LinkRow; stamp: string; link: EntityLink }>();
  for (const task of tasks) {
    const stamp = carrierStamp(task);
    for (const entry of task.links as unknown[]) {
      if (!isLegacy(entry)) continue;
      const link = todoLink(task.id, entry);
      let data: LinkRow;
      try {
        data = toRow(link);
      } catch {
        continue; // a link that must not be stored (the vault, no link target, malformed)
      }
      wanted.set(await linkId(link), { data, stamp, link });
    }
  }
  if (wanted.size === 0) return 0;

  if (opts.revive) {
    for (const { link } of wanted.values()) await addLink(link, database);
    return wanted.size;
  }

  const ids = [...wanted.keys()];
  const existing = await linksRepo(database).table.bulkGet(ids);
  // Live or tombstone: present.
  const missing = ids.filter((_id, i) => !existing[i]);
  return writeStamped(
    missing.map((id) => ({ id, data: wanted.get(id)!.data, stamp: wanted.get(id)!.stamp })),
    database,
  );
}

let queue: Promise<unknown> = Promise.resolve();

/** One run at a time, never throwing: start-up, sync and restore must not fail (or overlap) over the copy. */
function enqueue(database: TaschenmesserDB, opts: { revive?: boolean } = {}): Promise<void> {
  const run = async (): Promise<void> => {
    try {
      await copyTodoLinks(database, opts);
    } catch {
      console.error('[entitylinks] copy of the ToDo links failed');
    }
  };
  const next = queue.then(run, run);
  queue = next;
  return next;
}

/** The app-start run: every start, with or without sync. The caller does not wait for it. */
export function copyTodoLinksAtStart(database: TaschenmesserDB = defaultDb): Promise<void> {
  return enqueue(database);
}

/**
 * After a completed sync round that moved something (an older app elsewhere keeps writing arrays; a link
 * written here was just pushed). A round that moved nothing costs no scan.
 */
export function copyTodoLinksAfterSync(
  database: TaschenmesserDB = defaultDb,
  moved = true,
): Promise<void> {
  return moved ? enqueue(database) : Promise.resolve();
}

/** After a restore. */
export function copyTodoLinksAfterRestore(
  database: TaschenmesserDB = defaultDb,
  opts: { revive?: boolean } = {},
): Promise<void> {
  return enqueue(database, opts);
}
