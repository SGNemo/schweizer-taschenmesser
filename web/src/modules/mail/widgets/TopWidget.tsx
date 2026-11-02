import { t } from '@/strings';
import { DueList } from '@/ui';
import { personName, shortWhen, subjectOf } from '../format';
import { useMailSummary } from '../useSummary';

/** The three most important unread mails. */
export default function TopWidget() {
  const s = useMailSummary();
  return (
    <DueList
      loading={!s}
      summary={s ? t.mail.widget.importantSummary(s.unread) : undefined}
      entries={(s?.top ?? []).map((th) => ({
        key: th.id,
        title: `${personName(th.from)}: ${subjectOf(th.subject)}`,
        tone: 'none' as const,
        label: shortWhen(th.date),
      }))}
      empty={t.mail.widget.empty}
      emptyAction={{ label: t.mail.widget.emptyAction, to: '/mail' }}
    />
  );
}
