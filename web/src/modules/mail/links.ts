/**
 * "Created from this mail": remember what came out of a mail, and find it again. The entries live in
 * their own modules; a link only holds ids. Titles are read from the entries when shown, so renames
 * and deletes there are followed (a link to a deleted entry is dropped).
 *
 * Two stores answer „what came out of this thread“ (planner hub S1, CONCEPT-LINKS §1.3):
 *  - `mail_link`, device-local: account key and message id, which never sync. It keeps answering „did this
 *    device file this message“ (the row's „Angelegt“ mark).
 *  - `_links` (`core/entitylinks`), synced: entity → mail thread. Thread id, the cleaned subject (≤ 120) and the
 *    mail's day – never an address, the account key, a message id or text of the mail. The list „Aus dieser Mail
 *    angelegt“ reads both, so a second desktop that never filed the mail shows the same entries.
 */
import { createCollectionRepo } from '@/core/db/repo';
import { addLink, linkEntries, type LinkRel } from '@/core/entitylinks';
import { MAX_LINK_LABEL } from '@/core/entitylinks/types';
import { cleanSubject } from '@/core/mail/prefill';
import { safeThreadId } from '@/core/mail/service';
import { getManifest } from '@/core/modules/registry';
import { DATE_RE } from '@/core/time/dates';
import { targetFor, type SavedCapture } from '@/quickCapture/targets';
import { t } from '@/strings';
import { linkTypeOf, type MailLink } from './schema';
import { linkRepo } from './repo';

/**
 * Writes the synced link invoice → mail thread on the tap that filed the invoice (`origin`) or noted a reminder
 * on it (`dunning`). Returns its undo (nothing to undo when the link was there already – the id is deterministic,
 * so the same tap twice, or on two devices, is one row). Never fatal: the invoice is written by then, so a
 * failed link must not turn the toast into „nothing saved“.
 *
 * @param subject the subject as received: stored without reply prefixes, capped; empty → the app's own
 *   „(ohne Betreff)“.
 * @param day the mail's day, 'YYYY-MM-DD'.
 */
export async function linkInvoiceToThread(
  invoiceId: string,
  threadId: string,
  subject: string,
  day: string | undefined,
  rel: Extract<LinkRel, 'origin' | 'dunning'>,
): Promise<() => Promise<void>> {
  const none = async (): Promise<void> => undefined;
  // Only a plain provider id is ever stored (the resolver reads anything else as gone).
  const id = safeThreadId(threadId);
  if (!id) return none;
  try {
    return await addLink({
      from: { module: 'invoices', id: invoiceId },
      to: { module: 'mail', id },
      rel,
      label: (cleanSubject(subject) || t.mail.page.noSubject).slice(0, MAX_LINK_LABEL),
      ...(day && DATE_RE.test(day) ? { on: day } : {}),
    });
  } catch {
    return none;
  }
}

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
  /** Stable key of the entry: `<moduleId>:<entryId>` (one line per entry, whichever store names it). */
  id: string;
  /** Id of this device's `mail_link` row, when it has one (only such a row is ever dropped here). */
  localId?: string;
  type: MailLink['type'];
  moduleId: string;
  title: string;
  /** The entry's own route: `<module page>?open=<entryId>`. */
  to?: string;
  /** The entry is gone (deleted or its module is not installed): a local row can be dropped. */
  dead: boolean;
}

/** The field that names an entry in each destination collection. */
const TITLE_FIELD: Record<string, string> = { invoices: 'payee' };

/** What a synced link's carrier is called in the list (the modules that carry links to a mail today). */
const TYPE_OF_MODULE: Record<string, MailLink['type']> = { invoices: 'invoice', todos: 'todo' };

type Source = Pick<MailLink, 'type' | 'moduleId' | 'collection' | 'entryId'> & {
  localId?: string;
  createdAt: number;
};

/** Reads only: also runs inside a live query. */
export async function loadLinks(accountKey: string, threadId: string): Promise<LinkedEntry[]> {
  const local = await linkRepo
    .active()
    .filter((r) => r.accountKey === accountKey && r.threadId === threadId)
    .toArray();
  const sources = new Map<string, Source>();
  for (const r of local.sort((a, b) => a.createdAt - b.createdAt)) {
    const key = `${r.moduleId}:${r.entryId}`;
    if (!sources.has(key)) sources.set(key, { ...r, localId: r.id });
  }
  // The synced half: every thing that carries a link to this thread, filed on whichever device. Listed after
  // this device's own rows, in the order the links were made.
  const safe = safeThreadId(threadId);
  for (const e of safe ? await linkEntries({ module: 'mail', id: safe }) : []) {
    const type = e.direction === 'in' ? TYPE_OF_MODULE[e.other.module] : undefined;
    const key = `${e.other.module}:${e.other.id}`;
    if (!type || sources.has(key)) continue;
    sources.set(key, {
      type,
      moduleId: e.other.module,
      collection: targetFor(type).collection,
      entryId: e.other.id,
      createdAt: Number.MAX_SAFE_INTEGER,
    });
  }
  const out: LinkedEntry[] = [];
  for (const [key, r] of sources) {
    const manifest = getManifest(r.moduleId);
    const entry = manifest
      ? ((await createCollectionRepo(manifest, r.collection).get(r.entryId)) as
          Record<string, unknown> | undefined)
      : undefined;
    const title = entry ? entry[TITLE_FIELD[r.moduleId] ?? 'title'] : undefined;
    const page = manifest?.routes[0]?.path;
    out.push({
      id: key,
      ...(r.localId ? { localId: r.localId } : {}),
      type: r.type,
      moduleId: r.moduleId,
      title: typeof title === 'string' ? title : '',
      // The entry itself, not the module page (P44).
      ...(page ? { to: `${page}?open=${encodeURIComponent(r.entryId)}` } : {}),
      dead: !entry,
    });
  }
  return out;
}
