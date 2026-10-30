import { useLiveQuery } from 'dexie-react-hooks';
import { formatDay, today } from '@/core/time/dates';
import { tDeadline } from '@/strings.deadline';
import { dueState } from '@/core/time/due';
import { t } from '@/strings';
import { DueList } from '@/ui';
import { cancelDeadline, nextRelevantDate, sortDocuments, statusOf } from '../logic';
import { documentRepo } from '../repo';

/** Deadlines and expiries that need attention: act now, soon and already expired. */
export default function ExpiringWidget() {
  const docs = useLiveQuery(() => documentRepo.active().toArray(), []);
  const day = today();
  const urgent = sortDocuments(docs ?? [], day).filter((d) => {
    const s = statusOf(d, day);
    return s === 'act-now' || s === 'soon' || s === 'expired' || s === 'missed';
  });
  const act = urgent.filter((d) => statusOf(d, day) === 'act-now').length;
  const expired = urgent.filter((d) => statusOf(d, day) === 'expired').length;
  const missed = urgent.filter((d) => statusOf(d, day) === 'missed').length;
  const soon = urgent.length - expired - missed;
  return (
    <DueList
      loading={!docs}
      empty={t.vault.widgetEmpty}
      emptyAction={{ label: t.homeEmpty.vault, to: '/vault?new=1' }}
      summary={
        act > 0
          ? t.widgets.contractsSummary(act)
          : expired + soon > 0
            ? t.widgets.expirySummary(expired, soon)
            : missed > 0
              ? tDeadline.get().missedSummary(missed)
              : undefined
      }
      entries={urgent.map((d) => {
        if (statusOf(d, day) === 'missed') {
          // Calm: muted tone, no alarm colour; the date says what happened.
          return {
            key: d.id,
            title: d.title,
            tone: 'later' as const,
            label: tDeadline.get().missedOn(formatDay(cancelDeadline(d)!, 'd. MMM')),
          };
        }
        const s = dueState(nextRelevantDate(d, day)!, day, { soonDays: 60 });
        return { key: d.id, title: d.title, tone: s.tone, label: s.label };
      })}
      moreLabel={t.widgets.more}
    />
  );
}
