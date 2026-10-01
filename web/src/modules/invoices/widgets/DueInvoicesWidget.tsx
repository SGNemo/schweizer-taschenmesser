import { useLiveQuery } from 'dexie-react-hooks';
import { formatMoney } from '@/core/money';
import { relativeDayLabel, today } from '@/core/time/dates';
import { dueTone } from '@/core/time/due';
import { t } from '@/strings';
import { WidgetList } from '@/ui';
import { openTotal, sortInvoices } from '../logic';
import { invoiceRepo } from '../repo';

export default function DueInvoicesWidget() {
  const open = useLiveQuery(
    async () =>
      sortInvoices(await invoiceRepo.active().toArray()).filter((i) => i.status === 'open'),
    [],
  );
  const day = today();
  return (
    <WidgetList
      emptyAction={{ label: t.homeEmpty.invoices, to: '/invoices?new=1' }}
      loading={!open}
      empty={t.invoices.widgetEmpty}
      headline={open && open.length > 0 ? formatMoney(openTotal(open)) : undefined}
      subline={open && open.length > 0 ? t.invoices.openCount(open.length) : undefined}
      entries={(open ?? []).slice(0, 4).map((i) => ({
        key: i.id,
        title: i.payee,
        meta: relativeDayLabel(i.dueDate, day),
        overdue: dueTone(i.dueDate, false, day) === 'overdue',
      }))}
      to="/invoices"
      linkLabel={t.invoices.title}
    />
  );
}
