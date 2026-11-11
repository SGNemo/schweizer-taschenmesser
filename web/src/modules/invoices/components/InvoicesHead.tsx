import type { Stored } from '@/core/db/types';
import { today } from '@/core/time/dates';
import { dueState } from '@/core/time/due';
import { t } from '@/strings';
import { HeroFigure, HeroSlot } from '@/ui/identity';
import { openTotalText } from '../logic';
import type { Invoice } from '../schema';

/**
 * The head figure of the invoices page (Identity 4.0): the open sum with one context line. The line leads with what
 * matters – invoices past their date – and then the count, so a line shortened on the phone still says the right
 * thing (finding B2). The invoice due first is the first row of the list, with its own "bezahlt" button: the head
 * repeats neither.
 */
export function InvoicesHead({ invoices }: { invoices: Stored<Invoice>[] }) {
  const e = t.invoices.ext.head;
  const day = today();
  const open = invoices.filter((i) => i.status === 'open');
  const overdue = open.filter((i) => dueState(i.dueDate, day).tone === 'overdue').length;
  return (
    <HeroSlot area="figure">
      <div data-testid="invoices-head">
        {open.length > 0 ? (
          <HeroFigure
            value={openTotalText(open)}
            unit={e.open}
            detail={e.context(open.length, overdue)}
            sensitive
          />
        ) : (
          <HeroFigure value={e.nothing} />
        )}
      </div>
    </HeroSlot>
  );
}
