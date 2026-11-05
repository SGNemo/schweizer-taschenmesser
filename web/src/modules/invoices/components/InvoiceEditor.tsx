import { useState, type FormEvent } from 'react';
import type { Stored } from '@/core/db/types';
import { currencyOf, formatMoneyInput, isCurrencyCode, parseMoney } from '@/core/money';
import { addMonthsStr, today } from '@/core/time/dates';
import { deleteBlob, putBlob } from '@/core/blobs';
import { copyData } from '@/core/db/copy';
import { t } from '@/strings';
import {
  AdvancedFields,
  Button,
  CurrencyField,
  DateChips,
  Dialog,
  SelectField,
  TextArea,
  TextField,
  patternStyles,
} from '@/ui';
import { saveInvoice } from '../actions';
import { ibanValid } from '../iban';
import { attachmentKey, copyIban, copyPaymentData } from '../pay';
import { AttachmentSection, type AttachmentChoice } from './AttachmentSection';
import { PaymentsSection } from './PaymentsSection';
import { invoiceRepo } from '../repo';
import { INVOICE_REPEATS, type Invoice, type InvoiceRepeat } from '../schema';
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
  const [currency, setCurrency] = useState(currencyOf(existing));
  const [reference, setReference] = useState(existing?.reference ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [repeat, setRepeat] = useState<InvoiceRepeat | ''>(existing?.repeat ?? '');
  const [iban, setIban] = useState(existing?.iban ?? '');
  const [bic, setBic] = useState(existing?.bic ?? '');
  const [dunning, setDunning] = useState(String(existing?.dunningLevel ?? 0));
  const [dunnedAt, setDunnedAt] = useState(existing?.dunnedAt ?? '');
  const [attachment, setAttachment] = useState<AttachmentChoice>({ kind: 'keep' });
  const [error, setError] = useState('');
  const isPaid = existing?.status === 'paid';

  async function save(e: FormEvent) {
    e.preventDefault();
    const amountMinor = parseMoney(amount);
    if (!amountMinor || amountMinor < 1) {
      setError(t.money.invalidAmount(formatMoneyInput(1250)));
      return;
    }
    if (!isCurrencyCode(currency)) {
      setError(t.money.currencyInvalid);
      return;
    }
    // Part payments are added and removed in this dialog (PaymentsSection writes them at once):
    // take the stored ones, not those of the moment the dialog opened.
    const payments = existing ? (await invoiceRepo.get(existing.id))?.payments : undefined;
    const paidParts = (payments ?? []).reduce((sum, p) => sum + p.amountMinor, 0);
    if (amountMinor < paidParts) {
      setError(t.invoices.ext.payment.tooMuch(formatMoneyInput(paidParts)));
      return;
    }
    const file = attachment.kind === 'new' ? attachment.file : undefined;
    const attachmentMeta = file
      ? { name: file.name, mime: file.type, size: file.size }
      : attachment.kind === 'remove'
        ? undefined
        : existing?.attachment;
    const level = Number(dunning);
    const saved = await saveInvoice(existing?.id ?? null, {
      payee: payee.trim(),
      amountMinor,
      currency: currency === 'EUR' ? undefined : currency,
      dueDate,
      status: existing?.status ?? 'open',
      paidAt: isPaid ? paidAt || today() : undefined,
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
      repeat: repeat || undefined,
      repeatOf: existing?.repeatOf,
      payments,
      dunningLevel: level > 0 ? level : undefined,
      dunnedAt: level > 0 ? dunnedAt || undefined : undefined,
      iban: iban.trim() || undefined,
      bic: bic.trim() || undefined,
      attachment: attachmentMeta,
    });
    // The file goes to the device-local store after the record exists (its id is the key).
    if (file) await putBlob(attachmentKey(saved.id), file);
    else if (attachment.kind === 'remove' && existing?.attachment)
      await deleteBlob(attachmentKey(saved.id));
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
      <DateChips value={dueDate} onChange={setDueDate} />
      {isPaid ? (
        <TextField
          label={t.invoices.paidAt}
          type="date"
          value={paidAt}
          onChange={(e) => setPaidAt(e.target.value)}
        />
      ) : null}
      <SelectField
        label={t.invoices.repeat}
        value={repeat}
        onChange={(e) => setRepeat(e.target.value as InvoiceRepeat | '')}
        hint={t.invoices.repeatHint}
      >
        <option value="">{t.invoices.repeatOptions.none}</option>
        {INVOICE_REPEATS.map((r) => (
          <option key={r} value={r}>
            {t.invoices.repeatOptions[r]}
          </option>
        ))}
      </SelectField>
      {existing && !isPaid ? (
        <PaymentsSection invoiceId={existing.id} currency={existing.currency} onPaid={onClose} />
      ) : null}
      <AdvancedFields
        moduleId="invoices"
        hasData={
          !!reference ||
          !!note ||
          currencyOf(existing) !== 'EUR' ||
          !!iban ||
          Number(dunning) > 0 ||
          !!existing?.attachment
        }
      >
        <CurrencyField label={t.money.currency} value={currency} onChange={setCurrency} />
        <TextField
          label={t.invoices.reference}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
        <TextField
          label={t.invoices.ext.pay.iban}
          value={iban}
          onChange={(e) => setIban(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        {iban.trim() && !ibanValid(iban) ? (
          <p role="status" className={styles.muted}>
            {t.invoices.ext.pay.ibanCheck}
          </p>
        ) : null}
        <TextField
          label={t.invoices.ext.pay.bic}
          value={bic}
          onChange={(e) => setBic(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        {iban.trim() || reference.trim() ? (
          <div className={patternStyles.hstack}>
            <Button
              variant="ghost"
              onClick={() =>
                void copyPaymentData({
                  payee,
                  iban,
                  bic,
                  reference,
                  amountMinor: parseMoney(amount) ?? existing?.amountMinor ?? 0,
                  payments: existing?.payments,
                  currency: currency === 'EUR' ? undefined : currency,
                })
              }
            >
              {t.invoices.ext.pay.copyAll}
            </Button>
            {iban.trim() ? (
              <Button variant="ghost" onClick={() => void copyIban(iban)}>
                {t.invoices.ext.pay.copyIban}
              </Button>
            ) : null}
          </div>
        ) : null}
        <div className={styles.split}>
          <SelectField
            label={t.invoices.ext.dunning.label}
            value={dunning}
            onChange={(e) => setDunning(e.target.value)}
          >
            <option value="0">{t.invoices.ext.dunning.none}</option>
            {[1, 2, 3].map((n) => (
              <option key={n} value={String(n)}>
                {t.invoices.ext.dunning.level(n)}
              </option>
            ))}
          </SelectField>
          {Number(dunning) > 0 ? (
            <TextField
              label={t.invoices.ext.dunning.date}
              type="date"
              value={dunnedAt}
              onChange={(e) => setDunnedAt(e.target.value)}
            />
          ) : null}
        </div>
        <AttachmentSection
          invoiceId={existing?.id ?? null}
          meta={existing?.attachment}
          choice={attachment}
          onChoice={setAttachment}
        />
        <TextArea label={t.form.note} value={note} onChange={(e) => setNote(e.target.value)} />
      </AdvancedFields>
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
                      payments: undefined,
                      dunningLevel: undefined,
                      dunnedAt: undefined,
                      attachment: undefined,
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
