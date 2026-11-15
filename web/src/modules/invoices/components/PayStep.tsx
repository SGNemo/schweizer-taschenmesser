import { useState, type FormEvent } from 'react';
import type { Stored } from '@/core/db/types';
import { useSubmitOnce } from '@/core/forms/submitOnce';
import { formatMoney, formatMoneyInput, parseMoney } from '@/core/money';
import { today } from '@/core/time/dates';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, DayField, Dialog, FormActions, TextField } from '@/ui';
import { addPayment, removePayment } from '../actions';
import { remainingMinor } from '../logic';
import { payWithUndo } from '../quickActions';
import type { Invoice } from '../schema';
import styles from '../routes/invoices.module.css';

/**
 * The invoice's own pay step (planner hub S1, CONCEPT-LINKS §2 L7): what the plan row's „Bezahlt …“ and the
 * route `?open=<id>&do=pay` open. It shows what is open and asks once – the day (today) and the sum (what is
 * still open), both changeable – and only „Bezahlt“ writes: the whole rest marks the invoice as paid (finance
 * books it), less is recorded as a part payment. Either way the toast carries the undo. Opening this dialog
 * writes nothing; closing it writes nothing.
 */
export function PayStep({
  invoice,
  onClose,
}: {
  invoice: Stored<Invoice> | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={invoice !== null}
      onClose={onClose}
      title={invoice ? t.invoices.payStep.title(invoice.payee) : ''}
    >
      {invoice ? <Form key={invoice.id} invoice={invoice} onClose={onClose} /> : null}
    </Dialog>
  );
}

function Form({ invoice, onClose }: { invoice: Stored<Invoice>; onClose: () => void }) {
  const rest = remainingMinor(invoice);
  const money = (minor: number) => formatMoney(minor, invoice.currency);
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState(formatMoneyInput(rest));
  const [error, setError] = useState('');
  const p = t.invoices.payStep;

  async function pay(e: FormEvent) {
    e.preventDefault();
    const minor = parseMoney(amount);
    if (!minor || minor < 1) return setError(t.money.invalidAmount(formatMoneyInput(1250)));
    if (minor > rest) return setError(t.invoices.ext.payment.tooMuch(money(rest)));
    if (minor === rest) await payWithUndo(invoice.id, date || today());
    else {
      const payment = await addPayment(invoice.id, minor, date || today());
      useUiStore.getState().toast(
        t.invoices.ext.payment.added,
        payment
          ? {
              label: t.invoices.undo,
              run: () => void removePayment(invoice.id, payment.id),
            }
          : undefined,
      );
    }
    onClose();
  }
  const payOnce = useSubmitOnce(pay);

  return (
    <form onSubmit={payOnce} className={styles.form}>
      <p className={styles.muted} data-testid="pay-step-open">
        {p.open(money(rest))}
      </p>
      <div className={styles.split}>
        <DayField label={t.invoices.paidAt} value={date} onChange={setDate} required />
        <TextField
          label={t.invoices.ext.payment.amount}
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setError('');
          }}
          error={error}
          hint={p.amountHint}
          required
        />
      </div>
      <FormActions>
        <Button onClick={onClose}>{t.actions.cancel}</Button>
        <Button type="submit" variant="primary" data-autofocus data-testid="pay-step-confirm">
          {p.confirm}
        </Button>
      </FormActions>
    </form>
  );
}
