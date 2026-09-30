import { formatMoney } from '@/core/money';
import type { AiComputedResult } from '@/core/modules/types';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { listOpenInvoices, sumOpenInvoices } from './public';

export default async function compute(name: string): Promise<AiComputedResult | undefined> {
  if (name !== 'open') return undefined;
  const open = await listOpenInvoices();
  const lines: AiComputedResult['lines'] = [
    { label: t.ai.computed.openCount, value: String(open.length) },
    { label: t.ai.computed.openTotal, value: formatMoney(await sumOpenInvoices()) },
  ];
  const next = open[0];
  if (next) {
    lines.push({
      label: t.ai.computed.nextDue,
      value: `${next.payee}, ${formatDay(next.dueDate, 'EEE, d. MMM yyyy')}`,
    });
  }
  return { title: t.invoices.title, lines };
}
