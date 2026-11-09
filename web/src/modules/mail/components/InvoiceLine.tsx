import { today } from '@/core/time/now';
import { t } from '@/strings';
import { Button } from '@/ui';
import { offerText, type InvoiceOffer } from '../invoiceRow';
import styles from './mail.module.css';

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
        ? { done: t.mail.invoice.createdMark }
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
      <span>{text}</span>
      {late ? <span className={styles.invoiceLate}>· {late}</span> : null}
      {verb && 'done' in verb ? <span data-testid="mail-invoice-done">· {verb.done}</span> : null}
      {verb && 'label' in verb ? (
        <Button size="sm" variant="ghost" aria-label={verb.aria} onClick={onAct}>
          {verb.label}
        </Button>
      ) : null}
    </p>
  );
}
