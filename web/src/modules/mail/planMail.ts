/**
 * „In den Plan“ straight from a mail („Kopf leer“ 3a, decisions/features.md 2026-11-08): one tap writes a
 * ToDo (plan entry when the planner is on) titled „<Absendername> · <Betreff>“, with a link back to the
 * thread and no preview sheet – the named exception to the preview rule; the title is visible in the
 * row before the tap and the toast carries the undo. The id is deterministic from the thread id only
 * (never an address or the device-local account key), so the same mail planned twice – also on a second
 * device once the first has synced – finds the first entry instead of doubling it.
 */
import { createCollectionRepo } from '@/core/db/repo';
import { cleanSubject, mailPlanTitle } from '@/core/mail/prefill';
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

const own = (account: MailAccountRef, from: MailAddress): boolean =>
  !!account.email && from.email.toLowerCase() === account.email.toLowerCase();

/** The other party: the account's own address never names the ToDo (a reply of one's own gives the subject). */
const otherParty = (account: MailAccountRef, from: MailAddress): MailAddress =>
  own(account, from) ? { email: '' } : from;

/**
 * The sender a thread is planned under: the newest message not written from this account, else the
 * first. The list keeps only the newest sender; `otherParty` then drops one's own name.
 */
export function fromOf(account: MailAccountRef, messages: readonly { from: MailAddress }[]) {
  return ([...messages].reverse().find((m) => !own(account, m.from)) ?? messages[0]!).from;
}

/** The title the ToDo gets (the preview shows exactly this). */
export const planTitle = (account: MailAccountRef, th: PlanThread): string =>
  mailPlanTitle(otherParty(account, th.from), th.subject, t.mail.page.noSubject);

/** The fields of the ToDo: title, 15 minutes, a soft due date when the subject names one, the way back. */
export function planFields(account: MailAccountRef, th: PlanThread) {
  const subject = cleanSubject(th.subject);
  const read = subject ? parseCapture(subject, { now: new Date(now()) }).fields : undefined;
  const note =
    account.key === DEMO_ACCOUNT ? undefined : mailWebUrl(account, th.id, { forStorage: true }); // never `?authuser=<address>`
  return {
    title: planTitle(account, th),
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
  const tasks = await createCollectionRepo(todos, 'task').table.bulkGet(rows.map((r) => r.entryId));
  return new Set(rows.filter((_, i) => tasks[i]?.deletedAt === null).map((r) => r.threadId));
}

/**
 * Threads whose ToDo from a mail was deleted (on this device or synced from another): the preview marks
 * them „war im Plan“ and leaves them unticked; only an explicit tick brings the entry back.
 */
export async function deletedThreads(threadIds: readonly string[]): Promise<Set<string>> {
  const todos = getManifest('todos');
  if (!todos || threadIds.length === 0) return new Set();
  const ids = await Promise.all(threadIds.map((id) => planMailId(id)));
  const rows = await createCollectionRepo(todos, 'task').table.bulkGet(ids);
  return new Set(threadIds.filter((_, i) => rows[i] && rows[i]!.deletedAt !== null));
}

/** The words for one mode: the planner on („im Plan“) or off (a plain ToDo). */
export const planWords = (type: 'plan' | 'todo') =>
  type === 'plan'
    ? {
        already: t.mail.plan.already,
        was: t.mail.plan.was,
        reinstate: t.mail.plan.reinstate,
        allDone: t.mail.plan.allDone,
      }
    : {
        already: t.mail.plan.alreadyTodo,
        was: t.mail.plan.todo.was,
        reinstate: t.mail.plan.todo.reinstate,
        allDone: t.mail.plan.todo.allDone,
      };

/**
 * Brings a deleted entry back. A ToDo saved while the planner was off has no plan row: then the ToDo
 * comes back alone (the planner reads ToDos anyway); never half of a two-stage entry.
 */
async function reinstate(type: 'plan' | 'todo', id: string): Promise<SavedCapture> {
  try {
    return await reinstateCapture(type, id);
  } catch (e) {
    if (type !== 'plan') throw e;
    return reinstateCapture('todo', id);
  }
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

/** The day the planner gave the ToDo, if it already did (read once; no waiting). */
async function plannedDay(todoId: string): Promise<string | undefined> {
  const todos = getManifest('todos');
  if (!todos) return undefined;
  const task = (await createCollectionRepo(todos, 'task').get(todoId)) as
    { plannedFor?: string } | undefined;
  return task?.plannedFor;
}

/** Whether the entry is in the plan (its plan row exists), not only a ToDo. */
async function inPlan(todoId: string): Promise<boolean> {
  const planner = getManifest('planner');
  if (!planner) return false;
  return !!(await createCollectionRepo(planner, 'item').get(`todos:${todoId}`));
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
  const words = planWords(type);
  try {
    const id = await planMailId(th.id);
    const saved = await saveCapture(type, planFields(account, th), { id });
    if (saved.existed === true) {
      await linkOnce(account, th.id, saved);
      onChanged();
      // „Schon im Plan“ only when it is in the plan; a ToDo from before the planner was on says so.
      return void toast(
        type === 'plan' && !(await inPlan(saved.id)) ? t.mail.plan.alreadyTodo : words.already,
      );
    }
    if (saved.existed === 'tombstone') {
      return void toast(words.was, {
        label: words.reinstate,
        run: () =>
          void (async () => {
            try {
              const back = await reinstate(type, id);
              const link = await linkOnce(account, th.id, back);
              onChanged();
              const again = type === 'plan' ? await plannedDay(back.id) : undefined;
              const said =
                type === 'todo'
                  ? t.mail.plan.savedTodo
                  : again
                    ? t.mail.plan.planned(dayName(again))
                    : t.mail.plan.plannedNoDay;
              toast(said, {
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
 * already there is skipped and never touched; a deleted one comes back only when it was ticked while
 * marked „war im Plan“. All or nothing: a failure takes back everything this tap wrote or brought back.
 * One undo takes back what this tap did.
 */
export async function planMany(
  account: MailAccountRef,
  threads: readonly PlanThread[],
  onChanged: () => void,
): Promise<void> {
  const toast = useUiStore.getState().toast;
  const type = await planType();
  if (!type || threads.length === 0) return;
  const words = planWords(type);
  const items: CaptureItem[] = [];
  for (const th of threads)
    items.push({ type, fields: planFields(account, th), id: await planMailId(th.id) });
  let saved: SavedCapture | undefined;
  const revived: SavedCapture[] = [];
  try {
    saved = await saveCaptures(items, '');
    const todos = getManifest('todos');
    const taskRepo = todos ? createCollectionRepo(todos, 'task') : undefined;
    for (const item of items) {
      const row = taskRepo ? await taskRepo.table.get(item.id!) : undefined;
      if (row && row.deletedAt !== null) revived.push(await reinstate(type, item.id!));
    }
    // Link rows for every mail whose ToDo is live now (written, brought back or already there).
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
    const added = (saved.count ?? 0) + revived.length;
    if (added === 0) return void toast(words.already);
    const done = saved;
    toast(words.allDone(added), {
      label: t.mail.write.undo,
      run: () =>
        void (async () => {
          await done.undo();
          for (const r of revived) await r.undo();
          for (const l of links) await linkRepo.remove(l);
          onChanged();
          toast(t.mail.write.undone);
        })(),
    });
  } catch {
    // All or nothing: what this tap wrote or brought back goes again.
    await Promise.allSettled([saved?.undo(), ...revived.map((r) => r.undo())]);
    onChanged();
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
