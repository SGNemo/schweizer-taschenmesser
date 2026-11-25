/**
 * Document deadlines within 14 days (cancel by, renew by) as a part of the planner's „Finanzen checken“ (planner hub
 * 2, package 2): the same rows this module hands the plan (`plannable.ts`), named by key only – never a document's
 * content or title.
 */
import type { PileSource } from '@/core/modules/types';
import { addDaysStr } from '@/core/time/dates';
import { t } from '@/strings';
import plannable from './plannable';

/** Deadlines this close fold into the pile. */
export const PILE_DAYS = 14;

const source: PileSource = async ({ today, until }) => {
  const near = addDaysStr(today, PILE_DAYS);
  const items = await plannable.list({ today, until: until < near ? until : near });
  return [
    {
      area: 'money',
      id: 'deadlines',
      count: 0,
      label: t.planner.pile.deadlines,
      head: t.planner.pile.head.vault,
      to: '/vault',
      members: items.map((i) => `vault:${i.id}`),
    },
  ];
};

export default source;
