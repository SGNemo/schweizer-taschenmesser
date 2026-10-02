import { useLiveQuery } from 'dexie-react-hooks';
import { t } from '@/strings';
import { ProgressList } from '@/ui';
import { progress, sortLists } from '../logic';
import { itemRepo, listRepo } from '../repo';

/** Packing lists that are under way, with how much is packed. */
export default function PackingWidget() {
  const data = useLiveQuery(async () => {
    const [lists, items] = await Promise.all([
      listRepo.active().toArray(),
      itemRepo.active().toArray(),
    ]);
    return sortLists(lists)
      .filter((l) => l.kind === 'packing')
      .map((l) => ({ l, p: progress(items.filter((i) => i.listId === l.id)) }))
      .filter((x) => x.p.total > 0 && !x.p.complete);
  }, []);
  const done = (data ?? []).reduce((n, x) => n + x.p.done, 0);
  const total = (data ?? []).reduce((n, x) => n + x.p.total, 0);
  return (
    <ProgressList
      loading={!data}
      empty={t.lists.packingEmpty}
      emptyAction={{ label: t.lists.packingAction, to: '/lists?new=1' }}
      summary={total > 0 ? t.widgets.packingSummary(done, total) : undefined}
      entries={(data ?? []).map(({ l, p }) => ({
        key: l.id,
        title: l.name,
        value: p.done,
        max: p.total,
        detail: `${p.done}/${p.total}`,
      }))}
    />
  );
}
