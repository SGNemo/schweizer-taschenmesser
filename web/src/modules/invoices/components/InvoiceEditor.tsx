import { useState, type FormEvent } from 'react';
import type { Stored } from '@/core/db/types';
import { formatMoneyInput, parseMoney } from '@/core/money';
import { addMonthsStr, today } from '@/core/time/dates';
import { copyData } from '@/core/db/copy';
import { t } from '@/strings';
import { Button, Dialog, patternStyles, TextArea, TextField } from '@/ui';
import { saveInvoice } from '../actions';
import { invoiceRepo } from '../repo';
import type { Invoice } from '../schema';
import styles from '../routes/invoices.module.css';
import { deleteWithUndo, undoableWithToast } from '@/core/undo/withToast';

export type InvoiceTarget = Stored<Invoice> | { draft: true } | null;

export function InvoiceEditor({
  target,
  onClose,
  onDuplicated,
}: {
  target: InvoiceTarget;
  onClose: () => void;
  /** The copy made by "Duplizieren"; the page opens it for editing. */
  onDuplicated?: (copy: Stored<Invoice>) => void;
}) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={existing ? t.invoices.edit : t.invoices.add}
    >
      {target ? (
        <Form
          key={existing?.id ?? 'new'}
          existing={existing}
          onClose={onClose}
          onDuplicated={onDuplicated}
        />
      ) : null}
    </Dialog>
  );
}

function Form({
  existing,
  onClose,
  onDuplicated,
}: {
  existing: Stored<Invoice> | null;
  onClose: () => void;
  onDuplicated?: (copy: Stored<Invoice>) => void;
}) {
  const [payee, setPayee] = useState(existing?.payee ?? '');
  const [amount, setAmount] = useState(existing ? formatMoneyInput(existing.amountMinor) : '');
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? today());
  const [paidAt, setPaidAt] = useState(existing?.paidAt ?? '');
  const [reference, setReference] = useState(existing?.reference ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState('');
  const isPaid = existing?.status === 'paid';

  async function save(e: FormEvent) {
    e.preventDefault();
    const amountMinor = parseMoney(amount);
    if (!amountMinor || amountMinor < 1) {
      setError(t.money.invalidAmount(formatMoneyInput(1250)));
      return;
    }
    await saveInvoice(existing?.id ?? null, {
      payee: payee.trim(),
      amountMinor,
      dueDate,
      status: existing?.status ?? 'open',
      paidAt: isPaid ? paidAt || today() : undefined,
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
    });
    onClose();
  }

  return (
    <form onSubmit={save} className={styles.form}>
      <TextField
        label={t.invoices.payee}
        value={payee}
        onChange={(e) => setPayee(e.target.value)}
        required
        data-autofocus
      />
      <div className={styles.split}>
        <TextField
          label={t.money.amount}
          inputMode="decimal"
          placeholder="0,00"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setError('');
          }}
          error={error}
          required
        />
        <TextField
          label={t.invoices.dueDate}
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          required
        />
      </div>
      {isPaid ? (
        <TextField
          label={t.invoices.paidAt}
          type="date"
          value={paidAt}
          onChange={(e) => setPaidAt(e.target.value)}
        />
      ) : null}
      <TextField
        label={t.invoices.reference}
        value={reference}
        onChange={(e) => setReference(e.target.value)}
      />
      <TextArea label={t.form.note} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className={styles.actions}>
        {existing ? (
          <Button
            variant="danger"
            onClick={async () => {
              await deleteWithUndo(() => invoiceRepo.remove(existing.id));
              onClose();
            }}
          >
            {t.actions.delete}
          </Button>
        ) : (
          <span />
        )}
        <span className={patternStyles.hstack}>
          {existing ? (
            <Button
              variant="ghost"
              onClick={async () => {
                // The same invoice next month (rent, insurance): open again, one month later.
                const copy = await undoableWithToast(
                  t.actions.duplicated,
                  t.actions.duplicated,
                  () =>
                    invoiceRepo.create({
                      ...copyData(existing),
                      status: 'open',
                      paidAt: undefined,
                      dueDate: addMonthsStr(existing.dueDate, 1),
                    }),
                );
                onClose();
                onDuplicated?.(copy);
              }}
            >
              {t.actions.duplicate}
            </Button>
          ) : null}
          <Button onClick={onClose}>{t.actions.cancel}</Button>
          <Button type="submit" variant="primary">
            {t.actions.save}
          </Button>
        </span>
      </div>
    </form>
  );
}
