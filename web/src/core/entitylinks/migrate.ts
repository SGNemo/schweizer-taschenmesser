/**
 * Copy of the links a ToDo stores in its `links[]` field into the link table (CONCEPT-LINKS §1.3). The field
 * and its schema stay as they are (frozen; today's writers and older apps keep writing it) – this only makes
 * each entry readable from its other end.
 *
 * Every entry becomes the row `todos:<taskId> → <target>`, `origin`, under its deterministic id. Two rules keep
 * a copy from ever beating a removal:
 *  - **Only when absent:** an id that has a row on this device – live or tombstone – is skipped.
 *  - **Stamped like its source:** a copied row is not written "now" but with the HLC of the task's `links` field
 *    (every field, `deletedAt` too), merged by the sync rule and queued for upload – the way app migrations
 *    copy (`core/db/appMigrations.ts`). So every device writes identical ops, and a removal made anywhere after
 *    that array was written (a newer stamp) wins over the copy, also when this device has not pulled it yet.
 *
 * When it runs (`copyTodoLinksAtStart`, `copyTodoLinksAfterSync`, after a restore): at every app start – with
 * sync configured only once a pull completed on this device, so the first copy sees what the other devices
 * removed – and after a sync round that moved something. Never inside a Dexie upgrade: hashing is no Dexie
 * operation.
 */
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { getMeta, setMeta } from '@/core/db/metaKv';
import { createCollectionRepo } from '@/core/db/repo';
import { getManifest } from '@/core/modules/registry';
import { DexieStorageAdapter } from '@/core/storage/dexie';
import type { FieldOp } from '@/core/sync/types';
import { now } from '@/core/time/now';
import { addLink } from './index';
import { linkId, LINKS_TABLE, linksRepo, toRow, type LinkRow } from './store';
import { fromLegacy, LINK_KINDS, type EntityLink, type LegacyLink } from './types';

/** `_meta` key (device-local): when this device first copied its ToDo links (with sync: after a completed pull). */
export const TODO_LINKS_COPIED_KEY = 'entitylinks.todoLinksCopied';

const HLC_RE = /^\d{13}-\d{4}-/;

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

/** The stamp a task's copied links carry: the one of its `links` field (the oldest of the row as a fallback). */
function stampOf(task: { _f?: Record<string, string> }): string | undefined {
  const own = task._f?.links;
  if (own && HLC_RE.test(own)) return own;
  return Object.values(task._f ?? {})
    .filter((s) => HLC_RE.test(s))
    .sort()[0];
}

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
    const stamp = stampOf(task);
    if (!stamp) continue;
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
  const ops: FieldOp[] = [];
  ids.forEach((id, i) => {
    if (existing[i]) return; // live or tombstone: present
    const { data, stamp } = wanted.get(id)!;
    for (const [field, value] of Object.entries(data))
      ops.push({ collection: LINKS_TABLE, id, field, hlc: stamp, value });
    ops.push({ collection: LINKS_TABLE, id, field: 'deletedAt', hlc: stamp, value: null });
  });
  if (ops.length === 0) return 0;
  const storage = new DexieStorageAdapter(database, [LINKS_TABLE]);
  return (await storage.applyRemote(ops, { markDirty: true })).records;
}

async function run(database: TaschenmesserDB, opts: { revive?: boolean } = {}): Promise<boolean> {
  try {
    await copyTodoLinks(database, opts);
    return true;
  } catch {
    console.error('[entitylinks] copy of the ToDo links failed');
    return false;
  }
}

/**
 * The app-start run. Without sync: every start. With sync configured: only once a pull completed on this
 * device since the table exists (the flag) – before that, the first copy waits for `copyTodoLinksAfterSync`.
 */
export async function copyTodoLinksAtStart(
  database: TaschenmesserDB = defaultDb,
  syncConfigured = false,
): Promise<void> {
  const copiedBefore = Boolean(await getMeta(TODO_LINKS_COPIED_KEY, database).catch(() => false));
  if (syncConfigured && !copiedBefore) return;
  if ((await run(database)) && !copiedBefore && !syncConfigured)
    await setMeta(TODO_LINKS_COPIED_KEY, { at: now() }, database).catch(() => undefined);
}

/**
 * After a completed sync round: the first copy of this device, and later whenever the round moved something
 * (an older app elsewhere keeps writing arrays; a link written here was just pushed). Never throws.
 */
export async function copyTodoLinksAfterSync(
  database: TaschenmesserDB = defaultDb,
  moved = true,
): Promise<void> {
  const copiedBefore = Boolean(await getMeta(TODO_LINKS_COPIED_KEY, database).catch(() => false));
  if (copiedBefore && !moved) return;
  if ((await run(database)) && !copiedBefore)
    await setMeta(TODO_LINKS_COPIED_KEY, { at: now() }, database).catch(() => undefined);
}

/** After a restore. Never throws (a restore must not fail over it). */
export async function copyTodoLinksAfterRestore(
  database: TaschenmesserDB = defaultDb,
  opts: { revive?: boolean } = {},
): Promise<void> {
  await run(database, opts);
}
