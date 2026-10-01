import { useLiveQuery } from 'dexie-react-hooks';
import { relativeDayLabel, today } from '@/core/time/dates';
import { t } from '@/strings';
import { WidgetList } from '@/ui';
import { expiryState, sortDocuments } from '../logic';
import { documentRepo } from '../repo';

export default function ExpiringWidget() {
  const docs = useLiveQuery(() => documentRepo.active().toArray(), []);
  const day = today();
  const list = sortDocuments(docs ?? []).filter((d) => {
    const s = expiryState(d, day);
    return s === 'soon' || s === 'expired';
  });
  return (
    <WidgetList
      emptyAction={{ label: t.homeEmpty.vault, to: '/vault?new=1' }}
      loading={!docs}
      empty={list.length === 0 ? t.vault.widgetEmpty : undefined}
      entries={list.slice(0, 4).map((d) => ({
        key: d.id,
        title: d.title,
        meta: relativeDayLabel(d.expiresOn!, day),
        overdue: expiryState(d, day) === 'expired',
      }))}
      to="/vault"
      linkLabel={t.vault.title}
    />
  );
}
