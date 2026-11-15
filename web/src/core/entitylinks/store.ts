/**
 * The synced link table `_links`: one row per link (docs/design/planner-hub/CONCEPT-LINKS.md §1.2). This file is
 * the storage half of `core/entitylinks` – the row shape, the hashed id, the guards and the orphan sweep – and
 * imports no module contribution, so `core/modules/activation.ts` and `core/sync/tombstones.ts` can use it.
 * Everything else reads and writes links through `./index`.
 */
import { z } from 'zod';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { hashId } from '@/core/db/hashId';
import { createRepo, type Repo } from '@/core/db/repo';
import type { Stored } from '@/core/db/types';
import { allManifests } from '@/core/modules/registry';
import type { ModuleManifest } from '@/core/modules/types';
import { DATE_RE } from '@/core/time/dates';
import {
  linkRel,
  MAX_LINK_LABEL,
  NEVER_LINKED,
  refKey,
  type EntityLink,
  type EntityRef,
} from './types';

export const LINKS_TABLE = '_links';

const refSchema = z.object({ module: z.string().min(1), id: z.string().min(1).max(128) });

/** A stored link: the link plus both keys (the two indexes). `rel` is a plain string, read through `linkRel`. */
export const linkRowSchema = z.object({
  from: refSchema,
  to: refSchema,
  rel: z.string().min(1),
  label: z.string().max(MAX_LINK_LABEL),
  on: z.string().regex(DATE_RE).optional(),
  fromKey: z.string().min(1),
  toKey: z.string().min(1),
});
export type LinkRow = z.output<typeof linkRowSchema>;
export type StoredLink = Stored<LinkRow>;

/** The one repo of the table – written only through `createRepo`, like `_settings`. */
export const linksRepo = (database: TaschenmesserDB = defaultDb): Repo<LinkRow> =>
  createRepo(LINKS_TABLE, linkRowSchema, database);

/**
 * The row id: SHA-256 (hex) over `[fromKey, rel, toKey]`. Deterministic, so the same link made on two devices
 * is one row; a hash, because a record id travels in clear – no ref, module name or `rel` appears in it.
 */
export const linkId = (link: Pick<EntityLink, 'from' | 'to' | 'rel'>): Promise<string> =>
  hashId([refKey(link.from), link.rel, refKey(link.to)]);

/**
 * May this module be an end of a link? Never the vault; otherwise only a module that says what its entities
 * are (`contributions.linkTarget`). Asked of every known manifest, not only the ones of this platform: a mail
 * link stays readable on the phone (its target answers `unavailable`).
 */
export function isLinkable(
  moduleId: unknown,
  manifests: readonly ModuleManifest[] = allManifests,
): moduleId is string {
  if (typeof moduleId !== 'string' || moduleId === NEVER_LINKED) return false;
  return Boolean(manifests.find((m) => m.id === moduleId)?.contributions?.linkTarget);
}

const isRef = (ref: unknown): ref is EntityRef => refSchema.safeParse(ref).success;

/**
 * A stored row as a link, or `undefined` when it must not be read: an end in the vault or in a module without
 * `linkTarget`, a malformed ref, keys that do not belong to the refs. Rows arrive by sync, restore and the copy
 * of the ToDo links without passing `addLink`, so every reader goes through here.
 */
export function readLink(
  stored: object,
  manifests: readonly ModuleManifest[] = allManifests,
): EntityLink | undefined {
  const row = stored as Record<string, unknown>;
  const { from, to } = row;
  if (!isRef(from) || !isRef(to)) return undefined;
  if (!isLinkable(from.module, manifests) || !isLinkable(to.module, manifests)) return undefined;
  if (row.fromKey !== refKey(from) || row.toKey !== refKey(to)) return undefined;
  const label = typeof row.label === 'string' ? row.label.slice(0, MAX_LINK_LABEL) : '';
  const on = typeof row.on === 'string' && DATE_RE.test(row.on) ? row.on : undefined;
  return {
    from: { module: from.module, id: from.id },
    to: { module: to.module, id: to.id },
    rel: linkRel(row.rel),
    label,
    ...(on ? { on } : {}),
  };
}

/**
 * The row a link is written as. Throws for what must never be stored: an end in the vault or in a module that
 * is no link target, a link to itself, a malformed ref or day. The label is cut to its cap.
 */
export function toRow(
  link: EntityLink,
  manifests: readonly ModuleManifest[] = allManifests,
): LinkRow {
  for (const end of [link.from, link.to]) {
    if (end?.module === NEVER_LINKED) throw new Error('entitylinks: the vault is never linked');
    if (!isRef(end)) throw new Error('entitylinks: malformed ref');
    if (!isLinkable(end.module, manifests))
      throw new Error('entitylinks: module is no link target');
  }
  const fromKey = refKey(link.from);
  const toKey = refKey(link.to);
  if (fromKey === toKey) throw new Error('entitylinks: a thing cannot link to itself');
  if (link.on !== undefined && !DATE_RE.test(link.on))
    throw new Error('entitylinks: "on" must be YYYY-MM-DD');
  return {
    from: { module: link.from.module, id: link.from.id },
    to: { module: link.to.module, id: link.to.id },
    rel: linkRel(link.rel),
    label: String(link.label ?? '').slice(0, MAX_LINK_LABEL),
    ...(link.on ? { on: link.on } : {}),
    fromKey,
    toKey,
  };
}

/** Live rows whose `from` is one of the keys. */
async function liveFrom(repo: Repo<LinkRow>, fromKeys: string[]): Promise<StoredLink[]> {
  if (fromKeys.length === 0) return [];
  const rows = await repo.table.where('fromKey').anyOf(fromKeys).toArray();
  return rows.filter((r) => r.deletedAt === null);
}

/**
 * Wiping a module's data tombstones the links its things carried (`wipeModuleData`). Only rows whose `from`
 * is in that module; links that merely lead there stay (their target reads `gone`, the person removes them).
 * Returns how many rows were tombstoned.
 */
export async function removeLinksFromModule(
  moduleId: string,
  database: TaschenmesserDB = defaultDb,
): Promise<number> {
  const repo = linksRepo(database);
  const rows = await repo.table
    .where('fromKey')
    .between(`${moduleId}:`, `${moduleId};`) // ";" is the character after ":": every key `<moduleId>:…`
    .toArray();
  const ids = rows.filter((r) => r.deletedAt === null).map((r) => r.id);
  await repo.removeMany(ids);
  return ids.length;
}

/**
 * Orphan sweep: the tombstones of these records were just purged on this device (`purgeTombstones`), so the
 * links they carried are soft-deleted – a tombstone that syncs and is purged later like any row. It touches link
 * rows only, and the purge is the only reason: a record that is merely missing here never is. A purged id that
 * still names a record in another collection of the same module is left alone (a ref has no collection).
 */
export async function sweepPurged(
  purged: ReadonlyMap<string, readonly string[]>,
  database: TaschenmesserDB = defaultDb,
): Promise<number> {
  const repo = linksRepo(database);
  const tables = database.tables.map((t) => t.name);
  let removed = 0;
  for (const [table, ids] of purged) {
    if (table.startsWith('_') || ids.length === 0) continue;
    const moduleId = table.split('_')[0]!;
    const rows = await liveFrom(
      repo,
      ids.map((id) => `${moduleId}:${id}`),
    );
    if (rows.length === 0) continue;
    const siblings = tables.filter((n) => n !== table && n.startsWith(`${moduleId}_`));
    const orphaned: string[] = [];
    for (const row of rows) {
      const id = row.from.id;
      let stillThere = false;
      for (const name of siblings) {
        if ((await database.table(name).get(id)) !== undefined) stillThere = true;
      }
      if (!stillThere) orphaned.push(row.id);
    }
    await repo.removeMany(orphaned);
    removed += orphaned.length;
  }
  return removed;
}
