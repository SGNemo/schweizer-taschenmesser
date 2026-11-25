import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Stored } from '@/core/db/types';
import { useHideValuesSetting } from '@/core/focus/hideValues';
import { useSubmitOnce } from '@/core/forms/submitOnce';
import { PlanPanelFoot } from '@/core/modules/PlanPanelHost';
import { formatMoney, formatMoneyInput, parseMoney } from '@/core/money';
import { today } from '@/core/time/dates';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, DayField, Dialog, FormActions, TextField } from '@/ui';
import { addPayment, removePayment } from '../actions';
import { remainingMinor } from '../logic';
import { payWithUndo } from '../quickActions';
import { invoiceRepo } from '../repo';
import type { Invoice } from '../schema';
import styles from '../routes/invoices.module.css';

/**
 * The invoice's own pay step (planner hub S1, CONCEPT-LINKS §2 L7): what the plan row's „Bezahlt …“ and the
 * route `?open=<id>&do=pay` open. It shows what is open and asks once – the day (today) and the sum (what is
 * still open), both changeable – and only „Bezahlt“ writes: the whole rest marks the invoice as paid (finance
 * books it), less is recorded as a part payment. Either way the toast carries the undo. Opening this dialog
 * writes nothing; closing it writes nothing.
 *
 * `onPaid` runs once „Bezahlt“ went through (paid, part paid, or found paid elsewhere) – the page hands the person
 * back to the plan from there (M-1); cancelling, closing or a failed write never runs it.
 *
 * The step follows the invoice live: paid or deleted elsewhere while it is open, it closes with a calm word
 * and writes nothing; the state is checked once more right before the write, and a toast never claims a
 * write that did not happen.
 */
export function PayStep({
  invoice,
  onClose,
  onPaid,
}: {
  invoice: Stored<Invoice> | null;
  onClose: () => void;
  onPaid?: () => void;
}) {
  return (
    <Dialog
      open={invoice !== null}
      onClose={onClose}
      title={invoice ? t.invoices.payStep.title(invoice.payee) : ''}
    >
      {invoice ? (
        <PayForm key={invoice.id} invoice={invoice} onClose={onClose} onPaid={onPaid} />
      ) : null}
    </Dialog>
  );
}

/** The calm word for an invoice that is no longer open (paid elsewhere, deleted, gone). */
function notOpenMessage(invoice: Stored<Invoice> | undefined): string {
  return invoice?.status === 'paid' ? t.invoices.payStep.alreadyPaid : t.invoices.links.gone;
}

/**
 * The pay step's form. `layout="dialog"` is the page's step (above). `layout="panel"` is the same form as one line in
 * the invoice's plan panel (planner hub 2, package 4b; hand-off 04): the visible small labels „Bezahlt am“ and
 * „Betrag“, the day and the sum, and „Bezahlt“ (secondary) in the panel's foot beside „Ganz öffnen“ – no „Offen: …“
 * line (the row says the sum) and no cancel button (closing the row is the way out). While „Werte ausblenden“ is on,
 * the panel's sum starts empty: an empty sum pays what is open, a typed one is a part payment as on the page.
 */
export function PayForm({
  invoice: initial,
  onClose,
  onPaid,
  layout = 'dialog',
}: {
  invoice: Stored<Invoice>;
  onClose: () => void;
  onPaid?: () => void;
  layout?: 'dialog' | 'panel';
}) {
  const panel = layout === 'panel';
  // `undefined` while the switch is read: the panel shows no sum until it knows values may show.
  const hideSetting = useHideValuesSetting();
  const hide = hideSetting !== false;
  const id = initial.id;
  // `null` while the first read is under way; `undefined` once the invoice is gone (deleted or missing).
  const live = useLiveQuery(() => invoiceRepo.get(id), [id], null);
  const invoice = live ?? initial;
  const rest = remainingMinor(invoice);
  const money = (minor: number) => formatMoney(minor, invoice.currency);
  const [date, setDate] = useState(today());
  // Untouched (`undefined`): the open sum – in the panel only once values may show, never for a moment before.
  const [typed, setAmount] = useState<string | undefined>(undefined);
  const [prefill] = useState(() => formatMoneyInput(remainingMinor(initial)));
  const amount = typed ?? (panel && hide ? '' : prefill);
  const [error, setError] = useState('');
  // Set once this step writes (or decides not to): its own change must not read as „paid elsewhere“.
  const settled = useRef(false);
  const p = t.invoices.payStep;

  const stale = live === undefined || (live !== null && live.status !== 'open');
  useEffect(() => {
    if (!stale || settled.current) return;
    settled.current = true;
    useUiStore.getState().toast(notOpenMessage(live ?? undefined));
    onClose();
  }, [stale, live, onClose]);

  async function pay(e: FormEvent) {
    e.preventDefault();
    if (settled.current) return;
    // The panel's empty sum (values hidden) is the whole open rest.
    const minor = panel && amount.trim() === '' ? rest : parseMoney(amount);
    if (!minor || minor < 1) return setError(t.money.invalidAmount(formatMoneyInput(1250)));
    if (minor > rest) return setError(t.invoices.ext.payment.tooMuch(money(rest)));
    settled.current = true;
    const toast = useUiStore.getState().toast;
    let through = false;
    try {
      // Once more right before the write: paid or deleted meanwhile means nothing is written.
      const current = await invoiceRepo.get(id);
      if (!current || current.status !== 'open') {
        toast(notOpenMessage(current));
      } else if (minor >= remainingMinor(current)) {
        await payWithUndo(id, date || today());
      } else {
        const payment = await addPayment(id, minor, date || today());
        if (payment)
          toast(t.invoices.ext.payment.added, {
            label: t.invoices.undo,
            run: () => void removePayment(id, payment.id),
          });
        else toast(notOpenMessage(await invoiceRepo.get(id)));
      }
      through = true;
    } catch {
      toast(p.failed);
    }
    onClose();
    if (through) onPaid?.();
  }
  const payOnce = useSubmitOnce(pay);

  if (panel)
    return (
      <form onSubmit={payOnce} data-testid="pay-panel">
        <div className={styles.payLine}>
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
            required={!hide}
            className={styles.payAmount}
          />
        </div>
        <PlanPanelFoot>
          <Button type="submit" variant="secondary" data-testid="pay-panel-confirm">
            {t.invoices.paid}
          </Button>
        </PlanPanelFoot>
      </form>
    );
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
