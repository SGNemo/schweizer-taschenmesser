/**
 * Budgets' lines in the planner's „Finanzen checken“ (planner hub 2, package 2, COPY P14): one line per budget over its
 * frame this month, at most five, then X19 „{n} weitere“ (five more per tap). Read only, no `▸`; the amount goes
 * through `SensitiveValue` and never through planner code. Any id other than `over` shows nothing.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { formatMoney } from '@/core/money';
import { PanelLoading } from '@/core/modules/PlanPanelHost';
import type { PlanPanelProps } from '@/core/modules/types';
import { today } from '@/core/time/now';
import { t } from '@/strings';
import { Button, PanelLine, PanelLines, SensitiveValue } from '@/ui';
import { overBudgets } from '../over';
import { OVER_PANEL } from '../pile';

const STEP = 5;

export default function BudgetPlanPanel({ id }: PlanPanelProps) {
  const [shown, setShown] = useState(STEP);
  const over = useLiveQuery(() => (id === OVER_PANEL ? overBudgets(today()) : []), [id]);
  if (over === undefined) return <PanelLoading />;
  if (over.length === 0) return null;
  const rest = over.length - shown;
  return (
    <>
      <PanelLines>
        {over.slice(0, shown).map((b) => (
          <PanelLine key={b.id}>
            {b.name} ·{' '}
            <SensitiveValue compact>{formatMoney(b.overMinor, b.currency)}</SensitiveValue>{' '}
            {t.planner.pile.overFrame}
          </PanelLine>
        ))}
      </PanelLines>
      {rest > 0 ? (
        <Button variant="ghost" onClick={() => setShown((n) => n + STEP)}>
          {t.planner.panel.more(rest)}
        </Button>
      ) : null}
    </>
  );
}
