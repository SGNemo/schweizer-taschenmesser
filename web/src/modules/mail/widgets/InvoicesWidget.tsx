import { t } from '@/strings';
import { KpiWidget } from '@/ui';
import { useMailSummary } from '../useSummary';

/** Mails that look like invoices (local keyword check on the cached headers). */
export default function InvoicesWidget() {
  const s = useMailSummary();
  return (
    <KpiWidget
      loading={!s}
      value={s && s.invoices > 0 ? String(s.invoices) : undefined}
      label={t.mail.widget.invoices}
      context={t.mail.widget.invoicesContext(30)}
      empty={t.mail.widget.empty}
      emptyAction={{ label: t.mail.widget.emptyAction, to: '/mail?q=rechnung' }}
    />
  );
}
