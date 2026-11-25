/**
 * The cancel step of one deadline (planner hub 2, package 4b; hand-off 04, COPY X10, X11, X16): in a subscription's
 * plan panel (`layout="panel"`, every action in the panel's foot beside „Ganz öffnen“) and as the page's dialog for
 * `?do=cancel` (`layout="dialog"`). Opening it writes nothing; only „Vermerken“ and „Läuft weiter“ write, each with
 * the module's own undo toast (`cancelStep.ts`).
 */
import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { formatMoney, currencyOf } from '@/core/money';
import { PlanPanelFoot } from '@/core/modules/PlanPanelHost';
import { dayName } from '@/core/plan/explain';
import { describeRecurrence } from '@/core/recurrence/describe';
import { formatDay } from '@/core/time/dates';
import { today } from '@/core/time/now';
import { t } from '@/strings';
import { Button, DayField, Dialog, FormActions, PanelLine, PanelLines, SensitiveValue } from '@/ui';
import { keepRunning, markCancelled, type Deadline } from '../cancelStep';
import type { Subscription } from '../schema';

/** „Do 10. Dez.“ */
export const shortDay = (date: string) => `${dayName(date)} ${formatDay(date, 'd. MMM')}`;

function Body({
  sub,
  deadline,
  picking,
  day,
  onDay,
}: {
  sub: Stored<Subscription>;
  deadline: Deadline;
  picking: boolean;
  day: string;
  onDay: (day: string) => void;
}) {
  const c = t.subscriptions.cancelStep;
  return (
    <>
      <PanelLines>
        <PanelLine
          meta={
            <>
              <SensitiveValue compact>
                {formatMoney(sub.amountMinor, currencyOf(sub))}
              </SensitiveValue>
              {` · ${describeRecurrence(sub.recurrence)}`}
            </>
          }
        >
          {sub.name}
        </PanelLine>
        <PanelLine>{c.by(shortDay(deadline.date))}</PanelLine>
      </PanelLines>
      {picking ? (
        <DayField label={c.dayLabel} value={day} onChange={onDay} required data-autofocus />
      ) : null}
    </>
  );
}

export function CancelStep({
  sub,
  deadline,
  layout,
  onClose,
}: {
  sub: Stored<Subscription>;
  deadline: Deadline;
  layout: 'panel' | 'dialog';
  /** The dialog closes after a write or on „Abbrechen“; the panel leaves with its row. */
  onClose?: () => void;
}) {
  const c = t.subscriptions.cancelStep;
  const [picking, setPicking] = useState(false);
  const [day, setDay] = useState(today());
  const [busy, setBusy] = useState(false);
  const act = (write: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    void write().finally(() => {
      setBusy(false);
      onClose?.();
    });
  };
  const note = () => act(() => markCancelled(sub, deadline, day || today()));
  const keep = () => act(() => keepRunning(sub, deadline));
  const body = <Body sub={sub} deadline={deadline} picking={picking} day={day} onDay={setDay} />;

  if (layout === 'panel')
    return (
      <>
        {body}
        <PlanPanelFoot>
          {picking ? (
            <Button variant="secondary" aria-busy={busy} disabled={busy} onClick={note}>
              {c.note}
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setPicking(true)}>
                {c.cancelledOn}
              </Button>
              <Button variant="ghost" aria-busy={busy} disabled={busy} onClick={keep}>
                {c.keep}
              </Button>
            </>
          )}
        </PlanPanelFoot>
      </>
    );

  return (
    <Dialog open onClose={() => onClose?.()} title={c.title(sub.name)}>
      {body}
      <FormActions>
        {picking ? (
          <>
            <Button onClick={() => setPicking(false)}>{t.actions.cancel}</Button>
            <Button variant="primary" disabled={busy} onClick={note}>
              {c.note}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" disabled={busy} onClick={keep}>
              {c.keep}
            </Button>
            <Button variant="primary" onClick={() => setPicking(true)} data-autofocus>
              {c.cancelledOn}
            </Button>
          </>
        )}
      </FormActions>
    </Dialog>
  );
}
