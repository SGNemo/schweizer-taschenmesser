/**
 * Cancellation deadlines within 14 days as a part of the planner's „Finanzen checken“ (planner hub 2, package 2): the
 * same deadline rows this module hands the plan (`plannable.ts`), named by key only.
 */
import type { PileSource } from '@/core/modules/types';
import { addDaysStr } from '@/core/time/dates';
import { t } from '@/strings';
import plannable from './plannable';

/** Deadlines this close fold into the pile. */
export const PILE_DAYS = 14;
/** The jump into the subscriptions with a notice deadline (`?view=notice`, read once and taken off the URL). */
export const NOTICE_ROUTE = '/subscriptions?view=notice';

const source: PileSource = async ({ today, until }) => {
  const near = addDaysStr(today, PILE_DAYS);
  const items = await plannable.list({ today, until: until < near ? until : near });
  return [
    {
      area: 'money',
      id: 'notice',
      count: 0,
      label: t.planner.pile.deadlines,
      head: t.planner.pile.head.subscriptions,
      to: NOTICE_ROUTE,
      members: items.map((i) => `subscriptions:${i.id}`),
    },
  ];
};

export default source;
