import { useLiveQuery } from 'dexie-react-hooks';
import { t } from '@/strings';
import { ChecklistWidget } from '@/ui';
import { sortItems } from '../logic';
import { itemRepo } from '../repo';
import { SHOPPING_LIST_ID } from '../schema';

/** The open entries of the shopping list, ticked off in place. */
export default function OpenListsWidget() {
  const open = useLiveQuery(
    async () =>
      sortItems(await itemRepo.table.where('listId').equals(SHOPPING_LIST_ID).toArray()).filter(
        (i) => i.deletedAt === null && !i.done,
      ),
    [],
  );
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
