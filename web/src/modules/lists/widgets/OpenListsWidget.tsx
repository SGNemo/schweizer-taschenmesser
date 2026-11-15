import { useLiveQuery } from 'dexie-react-hooks';
import { t } from '@/strings';
import { ChecklistWidget } from '@/ui';
import { pickShoppingTarget, sortItems } from '../logic';
import { itemRepo, listRepo } from '../repo';

/** The open entries of the shopping list (the first one in use), ticked off in place. */
export default function OpenListsWidget() {
  const open = useLiveQuery(async () => {
    const target = pickShoppingTarget(await listRepo.active().toArray());
    if (!target) return [];
    return sortItems(await itemRepo.table.where('listId').equals(target.id).toArray()).filter(
      (i) => i.deletedAt === null && !i.done,
    );
  }, []);
  return (
    <ChecklistWidget
      loading={!open}
      empty={t.lists.widgetEmpty}
      emptyAction={{ label: t.lists.widgetAction, to: '/lists?new=1' }}
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
