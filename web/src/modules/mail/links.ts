/**
 * "Created from this mail": remember what came out of a mail, and find it again. The entries live in
 * their own modules; a link only holds ids. Titles are read from the entries when shown, so renames
 * and deletes there are followed (a link to a deleted entry is dropped).
 */
import { createCollectionRepo } from '@/core/db/repo';
import { getManifest } from '@/core/modules/registry';
import { targetFor, type SavedCapture } from '@/quickCapture/targets';
import { linkTypeOf, type MailLink } from './schema';
import { linkRepo } from './repo';

export async function saveLink(
  accountKey: string,
  threadId: string,
  messageId: string,
  saved: SavedCapture,
): Promise<string | undefined> {
  const type = linkTypeOf(saved.type);
  if (!type) return undefined;
  // A plan entry links to its ToDo (the first record: `saved.moduleId`/`saved.id` are the ToDo's).
  const row = await linkRepo.create({
    accountKey,
    threadId,
    messageId,
    type,
    moduleId: saved.moduleId,
    collection: targetFor(type).collection,
    entryId: saved.id,
  });
  return row.id;
}

export interface LinkedEntry {
  /** Id of the link row. */
  id: string;
  type: MailLink['type'];
  moduleId: string;
  title: string;
  /** Where the module lives (its first route). */
  to?: string;
  /** The entry is gone (deleted or its module is not installed): the row can be dropped. */
  dead: boolean;
}

/** The field that names an entry in each destination collection. */
const TITLE_FIELD: Record<string, string> = { invoices: 'payee' };

/** Reads only: also runs inside a live query. */
export async function loadLinks(accountKey: string, threadId: string): Promise<LinkedEntry[]> {
  const rows = await linkRepo
    .active()
    .filter((r) => r.accountKey === accountKey && r.threadId === threadId)
    .toArray();
  const out: LinkedEntry[] = [];
  for (const r of rows.sort((a, b) => a.createdAt - b.createdAt)) {
    const manifest = getManifest(r.moduleId);
    const entry = manifest
      ? ((await createCollectionRepo(manifest, r.collection).get(r.entryId)) as
          Record<string, unknown> | undefined)
      : undefined;
    const title = entry ? entry[TITLE_FIELD[r.moduleId] ?? 'title'] : undefined;
    out.push({
      id: r.id,
      type: r.type,
      moduleId: r.moduleId,
      title: typeof title === 'string' ? title : '',
      to: manifest?.routes[0]?.path,
      dead: !entry,
    });
  }
  return out;
}
