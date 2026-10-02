import { useLiveQuery } from 'dexie-react-hooks';
import { t } from '@/strings';
import { WidgetList } from '@/ui';
import { progress, sortItems, sortLists } from '../logic';
import { itemRepo, listRepo } from '../repo';
import { SHOPPING_LIST_ID } from '../schema';

/** Open shopping entries first; below them the progress of the packing lists that are under way. */
export default function OpenListsWidget() {
  const data = useLiveQuery(async () => {
    const [lists, items] = await Promise.all([
      listRepo.active().toArray(),
      itemRepo.active().toArray(),
    ]);
    const open = sortItems(items.filter((i) => i.listId === SHOPPING_LIST_ID && !i.done));
    const packing = sortLists(lists)
      .filter((l) => l.kind === 'packing')
      .map((l) => ({ list: l, stats: progress(items.filter((i) => i.listId === l.id)) }))
      .filter((p) => p.stats.total > 0 && !p.stats.complete);
    return { open, packing };
  }, []);
  const open = data?.open ?? [];
  const entries = [
    ...open.slice(0, 4).map((i) => ({ key: i.id, title: i.name, meta: i.quantity })),
    ...(data?.packing ?? []).slice(0, 2).map((p) => ({
      key: p.list.id,
      title: p.list.name,
      meta: `${p.stats.done}/${p.stats.total}`,
    })),
  ];
  return (
    <WidgetList
      loading={!data}
      empty={t.lists.widgetEmpty}
      emptyAction={{ label: t.lists.widgetAction, to: '/lists?new=1' }}
      headline={open.length > 0 ? t.lists.openCount(open.length) : undefined}
      entries={entries}
      to="/lists"
      linkLabel={t.lists.widgetOpen}
    />
  );
}
