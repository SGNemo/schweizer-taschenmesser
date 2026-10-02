import { useLiveQuery } from 'dexie-react-hooks';
import { t } from '@/strings';
import { ProgressList } from '@/ui';
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
  const packed = (data ?? []).reduce((n, x) => n + x.p.packed, 0);
  const total = (data ?? []).reduce((n, x) => n + x.p.total, 0);
  return (
    <ProgressList
      loading={!data}
      empty={t.packing.widgetEmpty}
      emptyAction={{ label: t.homeEmpty.packing, to: '/packing?new=1' }}
      summary={total > 0 ? t.widgets.packingSummary(packed, total) : undefined}
      entries={(data ?? []).map(({ l, p }) => ({
        key: l.id,
        title: l.name,
        value: p.packed,
        max: p.total,
        detail: `${p.packed} von ${p.total}`,
      }))}
    />
  );
}
