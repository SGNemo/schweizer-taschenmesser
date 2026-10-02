import { useLiveQuery } from 'dexie-react-hooks';
import { today } from '@/core/time/dates';
import { dueState } from '@/core/time/due';
import { t } from '@/strings';
import { DueList } from '@/ui';
import { nextRelevantDate, sortDocuments, statusOf } from '../logic';
import { documentRepo } from '../repo';

/** Deadlines and expiries that need attention: act now, soon and already expired. */
export default function ExpiringWidget() {
  const docs = useLiveQuery(() => documentRepo.active().toArray(), []);
  const day = today();
  const urgent = sortDocuments(docs ?? [], day).filter((d) => {
    const s = statusOf(d, day);
    return s === 'act-now' || s === 'soon' || s === 'expired';
  });
  const act = urgent.filter((d) => statusOf(d, day) === 'act-now').length;
  const expired = urgent.filter((d) => statusOf(d, day) === 'expired').length;
  return (
    <DueList
      loading={!docs}
      empty={t.vault.widgetEmpty}
      emptyAction={{ label: t.homeEmpty.vault, to: '/vault?new=1' }}
      summary={
        act > 0
          ? t.widgets.contractsSummary(act)
          : urgent.length > 0
            ? t.widgets.expirySummary(expired, urgent.length - expired)
            : undefined
      }
      entries={urgent.map((d) => {
        const s = dueState(nextRelevantDate(d, day)!, day, { soonDays: 60 });
        return { key: d.id, title: d.title, tone: s.tone, label: s.label };
      })}
      moreLabel={t.widgets.more}
    />
  );
}
