/**
 * „In den Plan“ straight from a mail („Kopf leer“ 3a, decisions/features.md 2026-11-08): one tap writes a
 * ToDo (plan entry when the planner is on) titled „<Absendername> · <Betreff>“, with a link back to the
 * thread and no preview sheet – the named exception to the preview rule; the title is visible in the
 * row before the tap and the toast carries the undo. The id is deterministic from the thread id only
 * (never an address or the device-local account key), so the same mail planned twice – also on a second
 * device once the first has synced – finds the first entry instead of doubling it.
 */
import { createCollectionRepo } from '@/core/db/repo';
import { mailPlanTitle } from '@/core/mail/prefill';
import { mailWebUrl } from '@/core/mail/service';
import type { MailAccountRef, MailAddress } from '@/core/mail/types';
import { loadModuleStates } from '@/core/modules/activation';
import { getManifest, visibleManifests } from '@/core/modules/registry';
import { dayName } from '@/core/plan/explain';
import { now, today } from '@/core/time/now';
import { parseCapture } from '@/quickCapture/parser';
import {
  availableTypes,
  captureId,
  reinstateCapture,
  saveCapture,
  saveCaptures,
  type CaptureItem,
  type SavedCapture,
} from '@/quickCapture/targets';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { DEMO_ACCOUNT } from './cache';
import { saveLink } from './links';
import { linkRepo } from './repo';

/** What the list knows about a thread: enough for the title and the link. */
export interface PlanThread {
  id: string;
  from: MailAddress;
  subject: string;
}

/** The entry's id: from the provider's thread id alone (the inputs are exactly `[threadId, 'todo']`). */
export const planMailId = async (threadId: string): Promise<string> =>
  `mail-${await captureId([threadId, 'todo'])}`;

const cleanSubject = (s: string) => s.replace(/^\s*((re|aw|fwd|wg):\s*)+/i, '').trim();

/** The fields of the ToDo: title, 15 minutes, a soft due date when the subject names one, the way back. */
export function planFields(account: MailAccountRef, th: PlanThread) {
  const subject = cleanSubject(th.subject);
  const read = subject ? parseCapture(subject, { now: new Date(now()) }).fields : undefined;
  const note =
    account.key === DEMO_ACCOUNT ? undefined : mailWebUrl(account, th.id, { forStorage: true }); // never `?authuser=<address>`
  return {
    title: mailPlanTitle(th.from, th.subject),
    estimateMin: 15,
    // A date in the subject is a soft due date (never a hard deadline: the mail did not say so).
    ...(read?.date && read.date >= today() ? { date: read.date } : {}),
    ...(note ? { note } : {}),
    link: { kind: 'mail' as const, id: th.id, label: subject || t.mail.page.noSubject },
  };
}

/** `plan` while the planner is on, else a plain ToDo („Als ToDo“). */
export async function planType(): Promise<'plan' | 'todo' | undefined> {
  const types = availableTypes(await loadModuleStates(visibleManifests));
  return types.includes('plan') ? 'plan' : types.includes('todo') ? 'todo' : undefined;
}

/** Thread ids of an account that have a ToDo made from them (the row says „im Plan“). */
export async function plannedThreads(accountKey: string): Promise<Set<string>> {
  const rows = await linkRepo
    .active()
    .filter((r) => r.accountKey === accountKey && r.type === 'todo')
    .toArray();
  const todos = getManifest('todos');
  if (!todos) return new Set();
  const repo = createCollectionRepo(todos, 'task');
  const out = new Set<string>();
  for (const r of rows) if (await repo.get(r.entryId)) out.add(r.threadId);
  return out;
}

/** Writes this device's link row once (another device's entry may already exist after sync). */
async function linkOnce(
  account: MailAccountRef,
  threadId: string,
  saved: SavedCapture,
): Promise<string | undefined> {
  const has = await linkRepo
    .active()
    .filter(
      (r) => r.accountKey === account.key && r.threadId === threadId && r.entryId === saved.id,
    )
    .first();
  return has ? undefined : saveLink(account.key, threadId, threadId, saved);
}

/** The planner's day for the new entry, when its run placed it within a moment (for the toast). */
async function plannedDay(todoId: string): Promise<string | undefined> {
  const planner = getManifest('planner');
  if (!planner) return undefined;
  const repo = createCollectionRepo(planner, 'assignment');
  for (let i = 0; i < 8; i++) {
    const row = (await repo
      .active()
      .filter((r) => r.itemKey === `todos:${todoId}`)
      .first()) as { date?: string } | undefined;
    if (row?.date) return row.date;
    await new Promise((r) => setTimeout(r, 150));
  }
  return undefined;
}

/**
 * One tap: the mail becomes a ToDo / plan entry. Already there → only this device's link, „Schon im Plan“,
 * no undo. Deleted before → „War im Plan · Wieder einplanen“ (brings the same entry back).
 */
export async function planMail(
  account: MailAccountRef,
  th: PlanThread,
  onChanged: () => void,
): Promise<void> {
  const toast = useUiStore.getState().toast;
  const type = await planType();
  if (!type) return void toast(t.mail.plan.failed);
  try {
    const id = await planMailId(th.id);
    const saved = await saveCapture(type, planFields(account, th), { id });
    if (saved.existed === true) {
      await linkOnce(account, th.id, saved);
      onChanged();
      return void toast(t.mail.plan.already);
    }
    if (saved.existed === 'tombstone') {
      return void toast(t.mail.plan.was, {
        label: t.mail.plan.reinstate,
        run: () =>
          void (async () => {
            try {
              const back = await reinstateCapture(type, id);
              const link = await linkOnce(account, th.id, back);
              onChanged();
              toast(t.mail.plan.plannedNoDay, {
                label: t.mail.write.undo,
                run: () => void undoPlan(back, link, onChanged),
              });
            } catch {
              toast(t.mail.plan.failed);
            }
          })(),
      });
    }
    const link = await linkOnce(account, th.id, saved);
    onChanged();
    const day = type === 'plan' ? await plannedDay(saved.id) : undefined;
    toast(
      type === 'todo'
        ? t.mail.plan.savedTodo
        : day
          ? t.mail.plan.planned(dayName(day))
          : t.mail.plan.plannedNoDay,
      { label: t.mail.write.undo, run: () => void undoPlan(saved, link, onChanged) },
    );
  } catch {
    toast(t.mail.plan.failed);
  }
}

async function undoPlan(saved: SavedCapture, link: string | undefined, onChanged: () => void) {
  await saved.undo();
  if (link) await linkRepo.remove(link);
  onChanged();
  useUiStore.getState().toast(t.mail.write.undone);
}

/**
 * „Alle in den Plan…“ after the preview: only the ticked threads, one id per mail; an entry that is
 * already there is skipped and never touched. One undo takes back what this tap wrote.
 */
export async function planMany(
  account: MailAccountRef,
  threads: readonly PlanThread[],
  onChanged: () => void,
): Promise<void> {
  const toast = useUiStore.getState().toast;
  const type = await planType();
  if (!type || threads.length === 0) return;
  try {
    const items: CaptureItem[] = [];
    for (const th of threads)
      items.push({ type, fields: planFields(account, th), id: await planMailId(th.id) });
    const saved = await saveCaptures(items, '');
    // Link rows for every mail whose ToDo is live now (written by this tap or already there); a deleted
    // one (tombstone) stays deleted and gets no link.
    const todos = getManifest('todos');
    const taskRepo = todos ? createCollectionRepo(todos, 'task') : undefined;
    const links: string[] = [];
    for (let i = 0; i < threads.length; i++) {
      if (!taskRepo || !(await taskRepo.get(items[i]!.id!))) continue;
      const entry: SavedCapture = {
        id: items[i]!.id!,
        type,
        moduleId: 'todos',
        undo: async () => undefined,
      };
      const link = await linkOnce(account, threads[i]!.id, entry);
      if (link) links.push(link);
    }
    onChanged();
    toast(t.mail.plan.allDone(saved.count ?? 0), {
      label: t.mail.write.undo,
      run: () =>
        void (async () => {
          await saved.undo();
          for (const l of links) await linkRepo.remove(l);
          onChanged();
          toast(t.mail.write.undone);
        })(),
    });
  } catch {
    toast(t.mail.plan.failed);
  }
}

/**
 * `?open=<threadId>` is untrusted input (a link from a ToDo, the planner, or anywhere): only a plain
 * provider id passes – letters, digits, `_` and `-`, at most 128 characters. Everything else opens nothing.
 */
export function safeThreadId(raw: string | null | undefined): string | undefined {
  return raw && /^[A-Za-z0-9_-]{1,128}$/.test(raw) ? raw : undefined;
}
