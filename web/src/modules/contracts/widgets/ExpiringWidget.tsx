import { useLiveQuery } from 'dexie-react-hooks';
import { today } from '@/core/time/dates';
import { dueState } from '@/core/time/due';
import { t } from '@/strings';
import { DueList } from '@/ui';
import { nextRelevantDate, sortContracts, statusOf } from '../logic';
import { contractRepo } from '../repo';

export default function ExpiringWidget() {
  const list = useLiveQuery(() => contractRepo.active().toArray(), []);
  const day = today();
  const urgent = sortContracts(list ?? [], day).filter((c) => {
    const s = statusOf(c, day);
    return s === 'act-now' || s === 'soon';
  });
  const act = urgent.filter((c) => statusOf(c, day) === 'act-now').length;
  return (
    <DueList
      loading={!list}
      empty={t.contracts.widgetEmpty}
      emptyAction={{ label: t.homeEmpty.contracts, to: '/contracts?new=1' }}
      summary={act > 0 ? t.widgets.contractsSummary(act) : undefined}
      entries={urgent.map((c) => {
        const s = dueState(nextRelevantDate(c, day)!, day, { soonDays: 7 });
        return { key: c.id, title: c.name, tone: s.tone, label: s.label };
      })}
      moreLabel={t.widgets.more}
    />
  );
}
