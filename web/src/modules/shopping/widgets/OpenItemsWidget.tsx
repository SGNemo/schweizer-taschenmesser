import { useLiveQuery } from 'dexie-react-hooks';
import { t } from '@/strings';
import { ChecklistWidget } from '@/ui';
import { sortItems } from '../logic';
import { itemRepo } from '../repo';

export default function OpenItemsWidget() {
  const open = useLiveQuery(
    async () => sortItems(await itemRepo.active().toArray()).filter((i) => !i.done),
    [],
  );
  return (
    <ChecklistWidget
      loading={!open}
      empty={t.shopping.widgetEmpty}
      emptyAction={{ label: t.homeEmpty.shopping, to: '/shopping?new=1' }}
      summary={open && open.length > 0 ? t.widgets.shoppingSummary(open.length) : undefined}
      entries={(open ?? []).map((i) => ({
        key: i.id,
        title: i.quantity ? `${i.name} (${i.quantity})` : i.name,
        checked: i.done,
      }))}
      onToggle={(id, done) => itemRepo.update(id, { done })}
    />
  );
}
