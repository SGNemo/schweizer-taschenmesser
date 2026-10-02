import { useLiveQuery } from 'dexie-react-hooks';
import { today } from '@/core/time/dates';
import { dueState } from '@/core/time/due';
import { t } from '@/strings';
import { DueList } from '@/ui';
import { expiryState, sortDocuments } from '../logic';
import { documentRepo } from '../repo';

export default function ExpiringWidget() {
  const docs = useLiveQuery(() => documentRepo.active().toArray(), []);
  const day = today();
  const list = sortDocuments(docs ?? []).filter((d) => {
    const s = expiryState(d, day);
    return s === 'soon' || s === 'expired';
  });
  const expired = list.filter((d) => expiryState(d, day) === 'expired').length;
  return (
    <DueList
      loading={!docs}
      empty={t.vault.widgetEmpty}
      emptyAction={{ label: t.homeEmpty.vault, to: '/vault?new=1' }}
      summary={
        list.length > 0 ? t.widgets.expirySummary(expired, list.length - expired) : undefined
      }
      entries={list.map((d) => {
        const s = dueState(d.expiresOn!, day, { soonDays: 60 });
        return { key: d.id, title: d.title, tone: s.tone, label: s.label };
      })}
      moreLabel={t.widgets.more}
    />
  );
}
