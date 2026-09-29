import { useLiveQuery } from 'dexie-react-hooks';
import { t } from '@/strings';
import { WidgetList } from '@/ui';
import { progress } from '../logic';
import { itemRepo, listRepo } from '../repo';

export default function ListsWidget() {
  const data = useLiveQuery(async () => {
    const [lists, items] = await Promise.all([
      listRepo.active().toArray(),
      itemRepo.active().toArray(),
    ]);
    return lists
      .map((l) => ({ l, p: progress(items.filter((i) => i.listId === l.id)) }))
      .filter((x) => x.p.total > 0 && !x.p.complete);
  }, []);
  return (
    <WidgetList
      loading={!data}
      empty={t.packing.widgetEmpty}
      entries={(data ?? []).slice(0, 4).map(({ l, p }) => ({
        key: l.id,
        title: l.name,
        meta: `${p.packed}/${p.total}`,
      }))}
      to="/packing"
      linkLabel={t.packing.title}
    />
  );
}
