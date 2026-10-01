import { useLiveQuery } from 'dexie-react-hooks';
import { t } from '@/strings';
import { WidgetList } from '@/ui';
import { itemRepo } from '../repo';

export default function RecentWidget() {
  const open = useLiveQuery(
    async () =>
      (await itemRepo.active().toArray())
        .filter((i) => !i.done)
        .sort((a, b) => b.createdAt - a.createdAt),
    [],
  );
  return (
    <WidgetList
      emptyAction={{ label: t.homeEmpty.bookmarks, to: '/bookmarks?new=1' }}
      loading={!open}
      empty={t.bookmarks.widgetEmpty}
      subline={open && open.length > 0 ? t.bookmarks.openCount(open.length) : undefined}
      entries={(open ?? []).slice(0, 4).map((i) => ({ key: i.id, title: i.title }))}
      to="/bookmarks"
      linkLabel={t.bookmarks.title}
    />
  );
}
