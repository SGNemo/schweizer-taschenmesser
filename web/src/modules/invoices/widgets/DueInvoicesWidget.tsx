import { useLiveQuery } from 'dexie-react-hooks';
import { formatMoney } from '@/core/money';
import { today } from '@/core/time/dates';
import { dueState } from '@/core/time/due';
import { t } from '@/strings';
import { DueList } from '@/ui';
import { openTotal, sortInvoices } from '../logic';
import { invoiceRepo } from '../repo';

export default function DueInvoicesWidget() {
  const open = useLiveQuery(
    async () =>
      sortInvoices(await invoiceRepo.active().toArray()).filter((i) => i.status === 'open'),
    [],
  );
  const day = today();
  const rows = (open ?? []).map((i) => ({ i, s: dueState(i.dueDate, day) }));
  const overdue = rows.filter((r) => r.s.tone === 'overdue').length;
  return (
    <DueList
      loading={!open}
      empty={t.invoices.widgetEmpty}
      emptyAction={{ label: t.homeEmpty.invoices, to: '/invoices?new=1' }}
      summary={
        open && open.length > 0
          ? t.widgets.invoicesSummary(formatMoney(openTotal(open)), overdue)
          : undefined
      }
      entries={rows.map(({ i, s }) => ({
        key: i.id,
        title: i.payee,
        amount: formatMoney(i.amountMinor),
        tone: s.tone,
        label: s.label,
      }))}
      moreLabel={t.widgets.more}
    />
  );
}
