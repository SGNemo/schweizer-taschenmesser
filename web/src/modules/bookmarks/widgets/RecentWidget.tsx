import { useLiveQuery } from 'dexie-react-hooks';
import { useModuleStates } from '@/core/modules/activation';
import { today } from '@/core/time/now';
import { t } from '@/strings';
import { WidgetList } from '@/ui';
import { isWeekendNear, pickNext } from '../logic';
import { itemRepo } from '../repo';

/**
 * "Als Nächstes" (from Friday: "Fürs Wochenende"): three open Merkzettel to pick from, not a count of what
 * waits. What is in the plan comes first, then what was started, then the newest; the permanent links have
 * their own widget.
 */
export default function RecentWidget() {
  const planner = useModuleStates()?.planner === true;
  const next = useLiveQuery(
    async () => pickNext(await itemRepo.active().toArray(), 3, planner),
    [planner],
  );
  return (
    <WidgetList
      emptyAction={{ label: t.homeEmpty.bookmarks, to: '/bookmarks?new=1' }}
      loading={!next}
      empty={t.bookmarks.widgetEmpty}
      subline={
        next && next.length > 0
          ? isWeekendNear(today())
            ? t.bookmarks.widgetWeekend
            : t.bookmarks.widgetNext
          : undefined
      }
      entries={(next ?? []).map((i) => ({
        key: i.id,
        title: i.title,
        meta: [t.bookmarks.kinds[i.kind], planner && i.inPlan ? t.bookmarks.inPlan : undefined]
          .filter(Boolean)
          .join(' · '),
      }))}
      to="/bookmarks"
      linkLabel={t.bookmarks.title}
    />
  );
}
