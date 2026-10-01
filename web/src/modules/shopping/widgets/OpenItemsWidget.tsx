import { useLiveQuery } from 'dexie-react-hooks';
import { t } from '@/strings';
import { WidgetList } from '@/ui';
import { sortItems } from '../logic';
import { itemRepo } from '../repo';

export default function OpenItemsWidget() {
  const open = useLiveQuery(
    async () => sortItems(await itemRepo.active().toArray()).filter((i) => !i.done),
    [],
  );
  return (
    <WidgetList
      emptyAction={{ label: t.homeEmpty.shopping, to: '/shopping?new=1' }}
      loading={!open}
      empty={t.shopping.widgetEmpty}
      headline={open ? t.shopping.openCount(open.length) : undefined}
      entries={(open ?? []).slice(0, 4).map((i) => ({
        key: i.id,
        title: i.name,
        meta: i.quantity,
      }))}
      to="/shopping"
      linkLabel={t.shopping.title}
    />
  );
}
