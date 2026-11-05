import { useLiveQuery } from 'dexie-react-hooks';
import { useSettings } from '@/core/settings/settings';
import { today } from '@/core/time/dates';
import { dueState } from '@/core/time/due';
import { t } from '@/strings';
import { KachelnBody, WidgetBody, useWidgetSize, type Kachel } from '@/ui';
import { expiryState, needsRestock, sortItems } from '../logic';
import { itemRepo } from '../repo';
import { PLACES } from '../schema';
import { settings as moduleSettings, settingsSchema } from '../settings';
import styles from './ExpiringWidget.module.css';

/** Widget variant `kacheln` (`KachelnBody`): one tile per place with its count and state in words, one context line, the most urgent item. */
export default function ExpiringWidget() {
  const size = useWidgetSize();
  const items = useLiveQuery(() => itemRepo.active().toArray(), []);
  const [prefs] = useSettings('module.pantry', settingsSchema, moduleSettings.defaults as never);
  const soonDays = (prefs as { soonDays?: number } | undefined)?.soonDays ?? 3;
  const day = today();
  const list = items ?? [];
  const due = sortItems(
    list.filter((i) => ['expired', 'soon'].includes(expiryState(i, day, soonDays))),
    day,
    soonDays,
  );
  const expired = due.filter((i) => expiryState(i, day, soonDays) === 'expired').length;
  const dueIds = new Set(due.map((i) => i.id));
  const low = list.filter((i) => needsRestock(i) && !dueIds.has(i.id));
  const total = due.length + low.length;
  // What needs a look, by name (up to three): expiring first, then what runs low.
  const next = [
    ...due.map((i) => ({
      id: i.id,
      name: i.name,
      label: dueState(i.expires!, day, { soonDays }).label,
    })),
    ...low.map((i) => ({ id: i.id, name: i.name, label: t.pantry.lowStock })),
  ].slice(0, size === 's' ? 2 : size === 'm' ? 3 : 5);

  const tiles: Kachel[] = PLACES.map((p) => {
    const here = list.filter((i) => i.place === p);
    const e = here.filter((i) => expiryState(i, day, soonDays) === 'expired').length;
    const s = here.filter((i) => expiryState(i, day, soonDays) === 'soon').length;
    const l = here.filter(needsRestock).length;
    return {
      key: p,
      value: String(here.length),
      label: t.pantry.places[p] ?? p,
      state: e
        ? t.pantry.shelf.expired(e)
        : s
          ? t.pantry.shelf.soon(s)
          : l
            ? t.pantry.shelf.low(l)
            : t.pantry.shelf.fine,
      // Expired and soon are a warning in words; red stays for money (FOCUS, C24).
      tone: e || s ? ('warning' as const) : undefined,
      to: '/pantry',
      n: here.length,
    };
  })
    .filter((k) => k.n > 0)
    .map(({ n: _n, ...k }) => k);

  return (
    <WidgetBody
      loading={!items}
      isEmpty={list.length === 0}
      empty={t.pantry.widgetEmpty}
      emptyAction={{ label: t.homeEmpty.pantry, to: '/pantry?new=1' }}
    >
      <KachelnBody tiles={tiles} />
      <p className={styles.context}>
        {total > 0
          ? t.widgets.expirySummary(expired, due.length - expired, low.length)
          : t.pantry.shelf.summaryFine}
      </p>
      {next.length > 0 ? (
        <ul className={styles.next}>
          {next.map((n) => (
            <li key={n.id}>
              {n.name} · {n.label}
            </li>
          ))}
        </ul>
      ) : null}
    </WidgetBody>
  );
}
