/**
 * A cancellation deadline's panel under its plan row (planner hub 2, package 4b; hand-off 04): name, price / period,
 * „Kündigen bis …“ and the module's cancel step – „Gekündigt am …“ (a day, then „Vermerken“) or „Läuft weiter“ – in
 * the foot beside „Ganz öffnen“. Either way the source no longer lists this deadline, so the row leaves with the
 * board's next reading. The id (`<subscription>:<date>`, `<subscription>:trial:<date>`) is untrusted.
 *
 * `compact` (a member line, package 2): name and „Kündigen bis …“ only – its two choices need the full panel.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { PanelGone, PanelLoading, PanelNote, PlanPanelFoot } from '@/core/modules/PlanPanelHost';
import type { PlanPanelProps } from '@/core/modules/types';
import { t } from '@/strings';
import { PanelLine, PanelLines } from '@/ui';
import { parseRowId } from '../cancelStep';
import { subscriptionRepo } from '../repo';
import { CancelStep, shortDay } from './CancelStep';

export default function SubscriptionPlanPanel({ id, compact }: PlanPanelProps) {
  const row = parseRowId(id);
  const sub = useLiveQuery(
    async () => (row ? ((await subscriptionRepo.get(row.subId)) ?? null) : null),
    [row?.subId],
  );
  if (sub === undefined) return <PanelLoading />;
  if (sub === null || !row) return <PanelGone />;
  const c = t.subscriptions.cancelStep;
  // Decided here or elsewhere meanwhile: said once, the row leaves with the next reading.
  if (sub.recurrence.until || sub.keptDeadline === row.deadline.date)
    return (
      <>
        <PanelNote>{sub.recurrence.until ? c.noted : c.kept}</PanelNote>
        <PlanPanelFoot />
      </>
    );
  if (compact)
    return (
      <PanelLines>
        <PanelLine meta={c.by(shortDay(row.deadline.date))}>{sub.name}</PanelLine>
      </PanelLines>
    );
  return <CancelStep key={sub.id} sub={sub} deadline={row.deadline} layout="panel" />;
}
