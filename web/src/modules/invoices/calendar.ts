import { notDeleted } from '@/core/db/repo';
import { formatMoney } from '@/core/money';
import type { CalendarSource } from '@/core/modules/types';
import { invoiceRepo } from './repo';

/** Open invoices appear on their due date. */
const source: CalendarSource = async (range) => {
  const invoices = await invoiceRepo.table
    .where('dueDate')
    .between(range.from, range.to, true, true)
    .filter((i) => notDeleted(i) && i.status === 'open')
    .toArray();
  return invoices.map((i) => ({
    id: i.id,
    source: 'invoices',
    kind: 'invoice',
    title: `${i.payee} · ${formatMoney(i.amountMinor)}`,
    date: i.dueDate,
    allDay: true,
    to: '/invoices',
  }));
};

export default source;
