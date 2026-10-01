import { useLiveQuery } from 'dexie-react-hooks';
import { useSettings } from '@/core/settings/settings';
import { formatDay, today } from '@/core/time/dates';
import { t } from '@/strings';
import { WidgetList } from '@/ui';
import { expiryState, sortItems } from '../logic';
import { itemRepo } from '../repo';
import { settings as moduleSettings, settingsSchema } from '../settings';

export default function ExpiringWidget() {
  const items = useLiveQuery(() => itemRepo.active().toArray(), []);
  const [prefs] = useSettings('module.pantry', settingsSchema, moduleSettings.defaults as never);
  const soonDays = (prefs as { soonDays?: number } | undefined)?.soonDays ?? 3;
  const day = today();
  const due = sortItems(
    (items ?? []).filter((i) => ['expired', 'soon'].includes(expiryState(i, day, soonDays))),
    day,
    soonDays,
  );
  return (
    <WidgetList
      emptyAction={{ label: t.homeEmpty.pantry, to: '/pantry?new=1' }}
      loading={!items}
      empty={items && due.length === 0 ? t.pantry.widgetEmpty : undefined}
      headline={due.length > 0 ? t.pantry.widgetHeadline(due.length) : undefined}
      entries={due.slice(0, 4).map((i) => ({
        key: i.id,
        title: i.name,
        meta: i.expires ? formatDay(i.expires, 'dd.MM.') : undefined,
      }))}
      to="/pantry"
      linkLabel={t.pantry.title}
    />
  );
}
