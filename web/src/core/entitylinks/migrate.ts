/**
 * Copy of the links a ToDo stores in its `links[]` field into the link table (CONCEPT-LINKS §1.3). The field
 * and its schema stay as they are (frozen; today's writers and older apps keep writing it) – this only makes
 * each entry readable from its other end.
 *
 * Every entry becomes the row `todos:<taskId> → <target>`, `origin`, through `addLinksIfAbsent`: the id is
 * deterministic, so two devices that both copy write the same row, and a row is created only when none has
 * that id – a tombstone counts as present, so a link the person removed is never brought back by the copy.
 *
 * When it runs: once per device at app start (`copyTodoLinksOnce`, guarded by a `_meta` flag), and again after
 * every sync round that changed something and after a restore (`copyTodoLinks`): an older app on another
 * device keeps writing arrays. Never inside a Dexie upgrade: hashing is no Dexie operation.
 */
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { getMeta, setMeta } from '@/core/db/metaKv';
import { createCollectionRepo } from '@/core/db/repo';
import { getManifest } from '@/core/modules/registry';
import { now } from '@/core/time/now';
import { addLink, addLinksIfAbsent } from './index';
import { fromLegacy, LINK_KINDS, type EntityLink, type LegacyLink } from './types';

/** `_meta` key (device-local): when this device first copied its ToDo links. */
export const TODO_LINKS_COPIED_KEY = 'entitylinks.todoLinksCopied';

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
 * a row the restore just tombstoned comes back (like a tap).
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
  const links: EntityLink[] = [];
  for (const task of tasks)
    for (const entry of task.links as unknown[])
      if (isLegacy(entry)) links.push(todoLink(task.id, entry));
  if (!opts.revive) return addLinksIfAbsent(links, database);
  for (const link of links) {
    try {
      await addLink(link, database);
    } catch {
      // A link that must not be stored is skipped.
    }
  }
  return links.length;
}

/** The app-start run: once per device. A failure leaves the flag unset, so the next start tries again. */
export async function copyTodoLinksOnce(database: TaschenmesserDB = defaultDb): Promise<void> {
  try {
    if (await getMeta(TODO_LINKS_COPIED_KEY, database)) return;
    const copied = await copyTodoLinks(database);
    await setMeta(TODO_LINKS_COPIED_KEY, { at: now(), copied }, database);
  } catch {
    console.error('[entitylinks] copy of the ToDo links failed');
  }
}

/** The run after a sync round or a restore: never throws (sync and restore must not fail over it). */
export async function copyTodoLinksAfterChange(
  database: TaschenmesserDB = defaultDb,
  opts: { revive?: boolean } = {},
): Promise<void> {
  try {
    await copyTodoLinks(database, opts);
  } catch {
    console.error('[entitylinks] copy of the ToDo links failed');
  }
}
