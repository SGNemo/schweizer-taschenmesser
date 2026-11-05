import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { formatMoney, formatMoneyInput, parseMoney } from '@/core/money';
import { formatDay, today } from '@/core/time/dates';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, Icon, TextField } from '@/ui';
import { addPayment, removePayment } from '../actions';
import { paidSum, remainingMinor } from '../logic';
import { invoiceRepo } from '../repo';
import type { Invoice } from '../schema';
import styles from '../routes/invoices.module.css';

/**
 * Part payments of an open invoice: the list, the rest as text and a small form. Reads the invoice
 * live, so the list is right after each change; the payment that covers the rest closes the dialog.
 */
export function PaymentsSection({
  invoiceId,
  currency,
  onPaid,
}: {
  invoiceId: string;
  currency: Invoice['currency'];
  onPaid: () => void;
}) {
  const invoice = useLiveQuery(() => invoiceRepo.get(invoiceId), [invoiceId]);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [error, setError] = useState('');
  const e = t.invoices.ext.payment;
  if (!invoice) return null;
  const rest = remainingMinor(invoice);
  const money = (m: number) => formatMoney(m, currency);

  async function add() {
    const minor = parseMoney(amount);
    if (!minor || minor < 1) {
      setError(t.money.invalidAmount(formatMoneyInput(1250)));
      return;
    }
    if (minor > rest) {
      setError(e.tooMuch(money(rest)));
      return;
    }
    await addPayment(invoiceId, minor, date);
    setAmount('');
    setError('');
    if (minor === rest) {
      useUiStore.getState().toast(e.coversRest);
      onPaid();
    } else useUiStore.getState().toast(e.added);
  }

  return (
    <section className={styles.paymentBox} aria-label={e.title}>
      <h3 className={styles.sectionTitle}>{e.title}</h3>
      {(invoice.payments ?? []).length === 0 ? (
        <p className={styles.muted}>{e.none}</p>
      ) : (
        <ul className={styles.paymentList}>
          {(invoice.payments ?? []).map((p) => (
            <li key={p.id}>
              <span>{e.row(money(p.amountMinor), formatDay(p.date, 'P'))}</span>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`${e.remove}: ${money(p.amountMinor)}`}
                onClick={() => void removePayment(invoiceId, p.id)}
              >
                <Icon name="trash" size={16} />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {paidSum(invoice) > 0 ? (
        <p className={styles.muted} data-testid="payment-rest">
          {t.invoices.ext.state.rest(money(rest))}
        </p>
      ) : null}
      <div className={styles.split}>
        <TextField
          label={e.amount}
          inputMode="decimal"
          placeholder={formatMoneyInput(rest)}
          value={amount}
          onChange={(ev) => {
            setAmount(ev.target.value);
            setError('');
          }}
          onKeyDown={(ev) => {
            // The section sits inside the invoice form: Enter adds the payment, not "Speichern".
            if (ev.key !== 'Enter') return;
            ev.preventDefault();
            void add();
          }}
          error={error}
        />
        <TextField
          label={e.date}
          type="date"
          value={date}
          onChange={(ev) => setDate(ev.target.value)}
        />
      </div>
      <div>
        <Button onClick={() => void add()}>{e.add}</Button>
      </div>
    </section>
  );
}
