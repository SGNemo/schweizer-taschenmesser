import { dayName } from '@/core/plan/explain';
import { addDaysStr, formatDay } from '@/core/time/dates';
import { today } from '@/core/time/now';
import { t } from '@/strings';
import { Button } from '@/ui';
import { offerText, type InvoiceOffer } from '../invoiceRow';
import styles from './mail.module.css';

/** „heute“, a weekday within this week, else the date: never two Wednesdays that read the same. */
function planDay(day: string): string {
  const now = today();
  if (day === now) return t.mail.invoice.today;
  return day <= addDaysStr(now, 6) ? dayName(day) : formatDay(day, 'd. MMM');
}

/**
 * The muted second line of an invoice row („Kopf leer“ 3b): payee, amount and date as text – exactly
 * what one tap writes – then one verb, or the quiet word for what is done. A debit has no verb.
 */
export function InvoiceLine({ offer, onAct }: { offer: InvoiceOffer; onAct: () => void }) {
  const { text, late } = offerText(offer, today());
  const line = late ? `${text} · ${late}` : text;
  const verb =
    offer.kind === 'create'
      ? offer.state === 'live'
        ? {
            done: offer.planned
              ? t.mail.invoice.inPlan(planDay(offer.planned))
              : t.mail.invoice.createdMark,
          }
        : { label: t.mail.invoice.create, aria: t.mail.invoice.createFor(line) }
      : offer.kind === 'note'
        ? offer.noted
          ? { done: t.mail.invoice.notedMark }
          : { label: t.mail.invoice.note, aria: t.mail.invoice.noteFor(line) }
        : offer.kind === 'check'
          ? { label: t.mail.invoice.check, aria: t.mail.invoice.checkFor(line) }
          : undefined;
  return (
    <p className={styles.invoiceLine} data-testid="mail-invoice-line">
      <span className={styles.invoiceText}>
        {text}
        {late ? <span className={styles.invoiceLate}> · {late}</span> : null}
        {verb && 'done' in verb ? (
          <span data-testid="mail-invoice-done"> · {verb.done}</span>
        ) : null}
      </span>
      {verb && 'label' in verb ? (
        <Button size="sm" variant="ghost" aria-label={verb.aria} onClick={onAct}>
          {verb.label}
        </Button>
      ) : null}
    </p>
  );
}
