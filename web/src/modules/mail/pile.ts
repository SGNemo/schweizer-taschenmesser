/**
 * The mail part of the planner's „E-Mails durchgehen“ (planner hub 2, package 2, CONCEPT-ROWS idea 2 (7)): the queue's
 * threads that have no plan ToDo yet (open or done – a done one leaves the count, a mail in the plan is counted once,
 * as its member) and the open ToDos made from a mail, by key. Count, route and keys only; the queue line in the pile
 * is this module's own `compact` panel (`components/PlanPanel.tsx`, id `queue`).
 */
import type { PileSource } from '@/core/modules/types';
import { t } from '@/strings';
import { openPlans, plannedThreads } from './planMail';
import { QUEUE_ROUTE, waitingByAccount } from './queue';

/** The id of this module's `compact` plan panel that draws the queue line (never a thread id: `safeThreadId` refuses `:`). */
export const QUEUE_PANEL = 'queue:waiting';

const source: PileSource = async () => {
  let count = 0;
  const members: string[] = [];
  for (const { accountKey, threadIds } of await waitingByAccount()) {
    const planned = await plannedThreads(accountKey);
    count += threadIds.filter((id) => !planned.has(id)).length;
    for (const todo of (await openPlans(accountKey)).values()) members.push(`todos:${todo}`);
  }
  return [
    {
      area: 'mail',
      id: 'queue',
      count,
      label: t.planner.pile.waiting,
      to: QUEUE_ROUTE,
      members,
      panel: QUEUE_PANEL,
    },
  ];
};

export default source;
