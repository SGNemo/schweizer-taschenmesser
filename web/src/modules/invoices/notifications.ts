import { notDeleted } from '@/core/db/repo';
import { formatMoney } from '@/core/money';
import type { NotificationSource } from '@/core/modules/types';
import { getSettings } from '@/core/settings/settings';
import { addDaysStr, toDateString, toEpoch } from '@/core/time/dates';
import { invoiceRepo } from './repo';
import { settings, settingsSchema } from './settings';

const DAY_MS = 86_400_000;

/** Reminds `remindDaysBefore` days ahead of each open invoice's due date. */
const source: NotificationSource = async ({ from, to }) => {
  const prefs = await getSettings('module.invoices', settingsSchema, settings.defaults as never);
  // The reminder date lies before the due date, so search due dates that far ahead.
  const fromDue = addDaysStr(toDateString(new Date(from)), prefs.remindDaysBefore);
  const toDue = addDaysStr(toDateString(new Date(to + DAY_MS)), prefs.remindDaysBefore);
  const invoices = await invoiceRepo.table
    .where('dueDate')
    .between(fromDue, toDue, true, true)
    .filter((i) => notDeleted(i) && i.status === 'open')
    .toArray();
  return invoices
    .map((i) => ({
      key: `invoice:${i.id}:${i.dueDate}`,
      at: toEpoch(addDaysStr(i.dueDate, -prefs.remindDaysBefore), prefs.remindTime),
      title: `Rechnung fällig: ${i.payee}`,
      body: `${formatMoney(i.amountMinor)} · fällig am ${i.dueDate.split('-').reverse().join('.')}`,
      url: '/invoices',
    }))
    .filter((n) => n.at > from && n.at <= to);
};

export default source;
