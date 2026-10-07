import { formatMoney } from '@/core/money';
import type { AttentionSource } from '@/core/modules/types';
import { t } from '@/strings';
import { invoiceRepo } from './repo';

/** Overdue invoices (danger) and invoices due today (accent). */
const source: AttentionSource = async ({ today }) => {
  const open = (await invoiceRepo.active().toArray()).filter((i) => i.status === 'open');
  const overdue = open.filter((i) => i.dueDate < today);
  const due = open.filter((i) => i.dueDate === today);
  const sum = (list: typeof open) => formatMoney(list.reduce((n, i) => n + i.amountMinor, 0));
  return [
    ...(overdue.length
      ? [
          {
            id: 'invoices:overdue',
            tone: 'danger' as const,
            icon: 'receipt' as const,
            title: t.attention.invoicesOverdue(overdue.length),
            detail: sum(overdue),
            to: '/invoices',
            rank: 1,
          },
        ]
      : []),
    ...(due.length
      ? [
          {
            id: 'invoices:today',
            tone: 'accent' as const,
            icon: 'receipt' as const,
            title: t.attention.invoicesToday(due.length),
            detail: sum(due),
            to: '/invoices',
            rank: 1,
          },
        ]
      : []),
  ];
};

export default source;
