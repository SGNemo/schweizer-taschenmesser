import { useLiveQuery } from 'dexie-react-hooks';
import { t } from '@/strings';
import { WidgetList } from '@/ui';
import { totals } from '../logic';
import { ideaRepo } from '../repo';

export default function SummaryWidget() {
  const ideas = useLiveQuery(() => ideaRepo.active().toArray(), []);
  const sum = totals(ideas ?? []);
  const open = (ideas ?? []).filter((i) => i.status === 'idea').slice(0, 4);
  return (
    <WidgetList
      loading={!ideas}
      empty={ideas && sum.open === 0 && sum.bought === 0 ? t.gifts.widgetEmpty : undefined}
      headline={
        sum.open + sum.bought > 0 ? t.gifts.widgetHeadline(sum.open, sum.bought) : undefined
      }
      entries={open.map((i) => ({ key: i.id, title: i.title, meta: t.gifts.forLabel(i.forWhom) }))}
      to="/gifts"
      linkLabel={t.gifts.title}
    />
  );
}
