import { useLiveQuery } from 'dexie-react-hooks';
import { today } from '@/core/time/dates';
import { t } from '@/strings';
import { tDeadline } from '@/strings.deadline';
import { DueList } from '@/ui';
import { statusOf, type Status } from '../logic';
import { documentRepo } from '../repo';

/**
 * Deadlines and expiries in numbers only: one row per state ("Abgelaufen 1", "Bald 2"). No document title,
 * file or provider is read into the overview; the titles are one tap away in the module.
 */
export default function ExpiringWidget() {
  const docs = useLiveQuery(() => documentRepo.active().toArray(), []);
  const day = today();
  const count = (s: Status) => (docs ?? []).filter((d) => statusOf(d, day) === s).length;
  const rows = [
    { s: 'expired' as const, tone: 'overdue' as const, title: t.vault.status.expired },
    { s: 'act-now' as const, tone: 'today' as const, title: t.vault.status['act-now'] },
    { s: 'soon' as const, tone: 'soon' as const, title: t.vault.status.soon },
    { s: 'missed' as const, tone: 'later' as const, title: tDeadline.get().missed ?? '' },
  ]
    .map((r) => ({ ...r, n: count(r.s) }))
    .filter((r) => r.n > 0);
  const total = rows.reduce((sum, r) => sum + r.n, 0);
  return (
    <DueList
      loading={!docs}
      empty={t.vault.widgetEmpty}
      emptyAction={{ label: t.homeEmpty.vault, to: '/vault?new=1' }}
      summary={total > 0 ? t.vault.widgetSummary(total) : undefined}
      entries={rows.map((r) => ({ key: r.s, title: r.title, tone: r.tone, label: String(r.n) }))}
    />
  );
}
