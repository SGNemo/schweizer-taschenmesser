import { useLiveQuery } from 'dexie-react-hooks';
import { relativeDayLabel, today } from '@/core/time/dates';
import { t } from '@/strings';
import { WidgetList } from '@/ui';
import { nextRelevantDate, sortContracts, statusOf } from '../logic';
import { contractRepo } from '../repo';

export default function ExpiringWidget() {
  const list = useLiveQuery(() => contractRepo.active().toArray(), []);
  const day = today();
  const urgent = sortContracts(list ?? [], day).filter((c) => {
    const s = statusOf(c, day);
    return s === 'act-now' || s === 'soon';
  });
  return (
    <WidgetList
      emptyAction={{ label: t.homeEmpty.contracts, to: '/contracts?new=1' }}
      loading={!list}
      empty={urgent.length === 0 ? t.contracts.widgetEmpty : undefined}
      entries={urgent.slice(0, 4).map((c) => ({
        key: c.id,
        title: c.name,
        meta: relativeDayLabel(nextRelevantDate(c, day)!, day),
        overdue: statusOf(c, day) === 'act-now',
      }))}
      to="/contracts"
      linkLabel={t.contracts.title}
    />
  );
}
