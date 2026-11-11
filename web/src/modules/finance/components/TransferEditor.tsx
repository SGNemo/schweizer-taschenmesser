import { useSubmitOnce } from '@/core/forms/submitOnce';
import { changedFields } from '@/core/db/patch';
import { useState, type FormEvent } from 'react';
import type { Stored } from '@/core/db/types';
import { randomId } from '@/core/db/util';
import { currencyOf, formatMoneyInput, parseMoney } from '@/core/money';
import { today } from '@/core/time/dates';
import { deleteWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import { Button, Dialog, FormActions, SelectField, TextField } from '@/ui';
import { transactionRepo } from '../repo';
import { buildTransfer, transferValid } from '../transfer';
import type { Transaction } from '../schema';
import type { FinanceData } from '../types';
import styles from '../routes/finance.module.css';

/** `{ draft }` creates a transfer, a row opens it (both halves). */
export type TransferTarget =
  { draft: true } | { out: Stored<Transaction>; in: Stored<Transaction> } | null;

/** The two halves of the transfer a booking belongs to, if its partner still exists. */
export function transferPair(
  data: FinanceData,
  tx: Pick<Stored<Transaction>, 'transferId'>,
): { out: Stored<Transaction>; in: Stored<Transaction> } | undefined {
  if (!tx.transferId) return undefined;
  const halves = data.txs.filter((x) => x.transferId === tx.transferId);
  const out = halves.find((x) => x.kind === 'expense');
  const inn = halves.find((x) => x.kind === 'income');
  return out && inn ? { out, in: inn } : undefined;
}

export function TransferEditor({
  target,
  data,
  onClose,
}: {
  target: TransferTarget;
  data: FinanceData;
  onClose: () => void;
}) {
  return (
    <Dialog
      askAfterTyping
      open={target !== null}
      onClose={onClose}
      title={t.finance.ext.transfer.title}
    >
      {target ? (
        <TransferForm
          key={'out' in target ? target.out.id : 'new'}
          target={target}
          data={data}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

function TransferForm({
  target,
  data,
  onClose,
}: {
  target: NonNullable<TransferTarget>;
  data: FinanceData;
  onClose: () => void;
}) {
  const existing = 'out' in target ? target : null;
  // The record as the editor opened it: only fields that differ from it are saved (QA X01).
  const [opened] = useState(existing);
  const [from, setFrom] = useState(existing?.out.accountId ?? data.accounts[0]?.id ?? '');
  const [to, setTo] = useState(existing?.in.accountId ?? data.accounts[1]?.id ?? '');
  const [amount, setAmount] = useState(existing ? formatMoneyInput(existing.out.amountMinor) : '');
  const [date, setDate] = useState(existing?.out.date ?? today());
  const [note, setNote] = useState(existing?.out.note ?? '');
  const [error, setError] = useState('');
  const e = t.finance.ext;

  async function save(ev: FormEvent) {
    ev.preventDefault();
    const amountMinor = parseMoney(amount);
    if (!amountMinor || amountMinor < 1) {
      setError(t.money.invalidAmount(formatMoneyInput(1250)));
      return;
    }
    const draft = {
      fromAccountId: from,
      toAccountId: to,
      amountMinor,
      date,
      note: note.trim() || undefined,
    };
    if (!transferValid(draft)) {
      setError(e.transfer.sameAccount);
      return;
    }
    if (existing) {
      const pair = buildTransfer(draft, existing.out.transferId ?? randomId());
      await transactionRepo.update(
        existing.out.id,
        changedFields((opened ?? existing).out, pair.out),
      );
      await transactionRepo.update(existing.in.id, changedFields((opened ?? existing).in, pair.in));
    } else {
      const pair = buildTransfer(draft, randomId());
      await transactionRepo.createMany([{ data: pair.out }, { data: pair.in }]);
    }
    onClose();
  }

  const label = (id: string) => data.accounts.find((a) => a.id === id);
  const fromCurrency = currencyOf(label(from));
  // One save per submit: a double click or Enter + click never saves twice (QA X13).
  const saveOnce = useSubmitOnce(save);
  return (
    <form onSubmit={saveOnce} className={styles.form}>
      <div className={styles.split}>
        <SelectField
          label={e.transfer.from}
          value={from}
          onChange={(ev) => setFrom(ev.target.value)}
        >
          {data.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </SelectField>
        <SelectField label={e.transfer.to} value={to} onChange={(ev) => setTo(ev.target.value)}>
          {data.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </SelectField>
      </div>
      <div className={styles.split}>
        <TextField
          label={fromCurrency === 'EUR' ? t.money.amount : `${t.money.amount} (${fromCurrency})`}
          inputMode="decimal"
          placeholder="0,00"
          value={amount}
          onChange={(ev) => {
            setAmount(ev.target.value);
            setError('');
          }}
          error={error}
          required
          data-autofocus
        />
        <TextField
          label={t.form.date}
          type="date"
          value={date}
          onChange={(ev) => setDate(ev.target.value)}
          required
        />
      </div>
      <TextField label={t.form.note} value={note} onChange={(ev) => setNote(ev.target.value)} />
      <FormActions
        start={
          existing ? (
            <Button
              variant="danger"
              onClick={async () => {
                await deleteWithUndo(() =>
                  transactionRepo.removeMany([existing.out.id, existing.in.id]),
                );
                onClose();
              }}
            >
              {t.actions.delete}
            </Button>
          ) : undefined
        }
      >
        <Button onClick={onClose}>{t.actions.cancel}</Button>
        <Button type="submit" variant="primary">
          {t.actions.save}
        </Button>
      </FormActions>
    </form>
  );
}
