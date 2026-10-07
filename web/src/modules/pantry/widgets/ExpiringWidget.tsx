import { useLiveQuery } from 'dexie-react-hooks';
import { useSettings } from '@/core/settings/settings';
import { today } from '@/core/time/dates';
import { dueState } from '@/core/time/due';
import { t } from '@/strings';
import { DueList } from '@/ui';
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
  const expired = due.filter((i) => expiryState(i, day, soonDays) === 'expired').length;
  return (
    <DueList
      loading={!items}
      empty={items && due.length === 0 ? t.pantry.widgetEmpty : undefined}
      emptyAction={{ label: t.homeEmpty.pantry, to: '/pantry?new=1' }}
      summary={due.length > 0 ? t.widgets.expirySummary(expired, due.length - expired) : undefined}
      entries={due.map((i) => {
        const s = dueState(i.expires!, day, { soonDays });
        return { key: i.id, title: i.name, tone: s.tone, label: s.label };
      })}
      moreLabel={t.widgets.more}
    />
  );
}
