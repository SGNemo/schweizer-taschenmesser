import { useLiveQuery } from 'dexie-react-hooks';
import { useSettings } from '@/core/settings/settings';
import { t } from '@/strings';
import { ChecklistWidget } from '@/ui';
import { pickWidgetList, sortItems } from '../logic';
import { itemRepo, listRepo } from '../repo';
import { settings, SETTINGS_SCOPE, settingsSchema } from '../settings';

/** The open entries of the chosen list (default: the first shopping list in use), ticked off in place. */
export default function OpenListsWidget() {
  const [prefs] = useSettings(SETTINGS_SCOPE, settingsSchema, settings.defaults);
  const chosen = prefs?.widgetList ?? '';
  const data = useLiveQuery(async () => {
    // Wait for the stored choice: no flash of the shopping list before the chosen one.
    if (!prefs) return undefined;
    const list = pickWidgetList(await listRepo.active().toArray(), chosen);
    if (!list) return { list: undefined, open: [] };
    const open = sortItems(await itemRepo.table.where('listId').equals(list.id).toArray()).filter(
      (i) => i.deletedAt === null && !i.done,
    );
    return { list, open };
  }, [chosen, !prefs]);
  const list = data?.list;
  const open = data?.open ?? [];
  const shopping = !list || list.kind === 'shopping';
  return (
    <ChecklistWidget
      loading={!data}
      empty={shopping ? t.lists.widgetEmpty : t.lists.widgetEmptyList(list.name)}
      emptyAction={{
        label: t.lists.widgetAction,
        to: list ? `/lists?list=${encodeURIComponent(list.id)}&new=1` : '/lists?new=1',
      }}
      summary={
        list && open.length > 0
          ? shopping
            ? t.widgets.shoppingSummary(open.length)
            : t.lists.widgetSummary(list.name, open.length)
          : undefined
      }
      entries={open.map((i) => ({
        key: i.id,
        title: i.quantity ? `${i.name} (${i.quantity})` : i.name,
        checked: i.done,
      }))}
      onToggle={(id, done) => itemRepo.update(id, { done })}
    />
  );
}
