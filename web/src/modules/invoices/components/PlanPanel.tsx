/**
 * An invoice's panel under its plan row (planner hub 2, package 4b; hand-off 04): nothing the row already says (sum and
 * deadline are in its meta), a reminder line when it is dunned, then the module's own pay step as one line
 * (`PayForm`, layout `panel`) with „Bezahlt“ in the foot. Paying writes exactly what the page's step writes, with its
 * own undo toast; the planner writes nothing (CONCEPT-LINKS L7 holds: the panel is this module's code).
 *
 * `compact` (a member line in a pile, package 2): the payee and one tap „Bezahlt“ – today, the whole open sum, as the
 * invoice list's own „Als bezahlt markieren“.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { PanelGone, PanelLoading, PanelNote, PlanPanelFoot } from '@/core/modules/PlanPanelHost';
import type { PlanPanelProps } from '@/core/modules/types';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, PanelLine, PanelLines, SensitiveValue } from '@/ui';
import { formatMoney } from '@/core/money';
import { dayName } from '@/core/plan/explain';
import { today } from '@/core/time/now';
import { hardDue } from '../plannable';
import { payWithUndo } from '../quickActions';
import { invoiceRepo } from '../repo';
import { PayForm } from './PayStep';

export default function InvoicePlanPanel({ id, compact }: PlanPanelProps) {
  const invoice = useLiveQuery(async () => (await invoiceRepo.get(id)) ?? null, [id]);
  if (invoice === undefined) return <PanelLoading />;
  if (invoice === null) return <PanelGone />;
  if (invoice.status !== 'open')
    return (
      <>
        <PanelNote>{t.invoices.payStep.alreadyPaid}</PanelNote>
        <PlanPanelFoot />
      </>
    );
  if (compact) {
    // Hand-off 02: „Stadtwerke · 80,00 € · Frist Fr 4. Dez.“ – a passed deadline reads X18 „Frist war So“.
    const due = hardDue(invoice);
    const when = `${dayName(due)} ${formatDay(due, 'd. MMM')}`;
    return (
      <PanelLines>
        <PanelLine
          meta={
            <>
              <SensitiveValue compact>
                {formatMoney(invoice.amountMinor, invoice.currency)}
              </SensitiveValue>
              {` · ${due < today() ? t.planner.row.dueWas(dayName(due)) : t.planner.row.due(when)}`}
            </>
          }
          action={
            <Button variant="ghost" onClick={() => void payWithUndo(invoice.id)}>
              {t.invoices.paid}
            </Button>
          }
        >
          {invoice.payee}
        </PanelLine>
      </PanelLines>
    );
  }
  const d = t.invoices.ext.dunning;
  return (
    <>
      {invoice.dunningLevel ? (
        <PanelNote>
          {invoice.dunnedAt
            ? `${d.level(invoice.dunningLevel)} · ${formatDay(invoice.dunnedAt, 'd. MMM')}`
            : d.level(invoice.dunningLevel)}
        </PanelNote>
      ) : null}
      <PayForm key={invoice.id} invoice={invoice} layout="panel" onClose={() => undefined} />
    </>
  );
}
