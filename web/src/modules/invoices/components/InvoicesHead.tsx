import type { Stored } from '@/core/db/types';
import { formatDay, today } from '@/core/time/dates';
import { dueState } from '@/core/time/due';
import { t } from '@/strings';
import { Button } from '@/ui';
import { HeroFigure, HeroSlot } from '@/ui/identity';
import { openTotalText } from '../logic';
import { payWithUndo } from '../quickActions';
import type { Invoice } from '../schema';

/**
 * The `fokus` head of the invoices page (identity v3.1, G04): the one thing large beside the small module name – the
 * open sum with one context line (count, overdue, the next payee) – and "Nächste bezahlen" for the invoice due first.
 * The frame draws the `bill` mark in the S slot next to it; there is no receipt card any more (that shape is Listen's).
 */
export function InvoicesHead({ invoices }: { invoices: Stored<Invoice>[] }) {
  const e = t.invoices.ext.head;
  const day = today();
  const open = invoices
    .filter((i) => i.status === 'open')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const next = open[0];
  const overdue = open.filter((i) => dueState(i.dueDate, day).tone === 'overdue').length;
  const detail = [
    e.count(open.length),
    overdue ? e.overdue(overdue) : '',
    next ? e.nextShort(next.payee, formatDay(next.dueDate, 'd. MMM')) : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <>
      <HeroSlot area="figure">
        <div data-testid="invoices-head">
          {next ? (
            <HeroFigure value={openTotalText(open)} unit={e.open} detail={detail} />
          ) : (
            <HeroFigure value={e.nothing} />
          )}
        </div>
      </HeroSlot>
      {next ? (
        <HeroSlot>
          <Button
            onClick={() => void payWithUndo(next.id)}
            aria-label={e.payNextName(next.payee)}
            data-testid="pay-next"
          >
            {e.payNext}
          </Button>
        </HeroSlot>
      ) : null}
    </>
  );
}
