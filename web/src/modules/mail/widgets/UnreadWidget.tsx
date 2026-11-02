import { t } from '@/strings';
import { KpiWidget } from '@/ui';
import { useMailSummary } from '../useSummary';

/** Unread inbox threads (from the local cache). */
export default function UnreadWidget() {
  const s = useMailSummary();
  const empty = s !== undefined && s.unread === 0 && s.top.length === 0 && s.invoices === 0;
  return (
    <KpiWidget
      loading={!s}
      value={s && !empty ? String(s.unread) : undefined}
      label={t.mail.widget.unread}
      context={s ? t.mail.widget.unreadContext(s.unread) : undefined}
      empty={t.mail.widget.empty}
      emptyAction={{ label: t.mail.widget.emptyAction, to: '/mail' }}
    />
  );
}
