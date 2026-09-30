import { useState, type FormEvent } from 'react';
import type { Stored } from '@/core/db/types';
import { formatMoneyInput, parseMoney } from '@/core/money';
import { today } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, Dialog, SelectField, TextArea, TextField } from '@/ui';
import { accountRepo, categoryRepo, deleteAccount, transactionRepo } from '../repo';
import type { Account, Category, Transaction } from '../schema';
import type { FinanceData } from '../types';
import styles from '../routes/finance.module.css';

type Kind = 'expense' | 'income';

function Actions({ onDelete, onClose }: { onDelete?: () => Promise<void>; onClose: () => void }) {
  return (
    <div className={styles.actions}>
      {onDelete ? (
        <Button
          variant="danger"
          onClick={async () => {
            await onDelete();
            onClose();
          }}
        >
          {t.actions.delete}
        </Button>
      ) : (
        <span />
      )}
      <span style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <Button onClick={onClose}>{t.actions.cancel}</Button>
        <Button type="submit" variant="primary">
          {t.actions.save}
        </Button>
      </span>
    </div>
  );
}

/* ---------------------------------- Transaction ---------------------------------- */

export type TransactionTarget = Stored<Transaction> | { draft: true } | null;

export function TransactionEditor({
  target,
  data,
  onClose,
}: {
  target: TransactionTarget;
  data: FinanceData;
  onClose: () => void;
}) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={existing ? t.finance.editTransaction : t.finance.addTransaction}
    >
      {target ? (
        <TransactionForm
          key={existing?.id ?? 'new'}
          existing={existing}
          data={data}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

function TransactionForm({
  existing,
  data,
  onClose,
}: {
  existing: Stored<Transaction> | null;
  data: FinanceData;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<Kind>(existing?.kind ?? 'expense');
  const [amount, setAmount] = useState(existing ? formatMoneyInput(existing.amountMinor) : '');
  const [date, setDate] = useState(existing?.date ?? today());
  const [chosenAccountId, setChosenAccountId] = useState(existing?.accountId ?? '');
  // Falls back to the first account, which may only appear after the defaults were created.
  const accountId = chosenAccountId || data.accounts[0]?.id || '';
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? '');
  const [payee, setPayee] = useState(existing?.payee ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState('');
  const categories = data.categories
    .filter((c) => c.kind === kind)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));

  async function save(e: FormEvent) {
    e.preventDefault();
    const amountMinor = parseMoney(amount);
    if (!amountMinor || amountMinor < 1) {
      setError(t.money.invalidAmount);
      return;
    }
    if (!accountId) return;
    const values = {
      accountId,
      categoryId: categories.some((c) => c.id === categoryId) ? categoryId : undefined,
      kind,
      amountMinor,
      date,
      payee: payee.trim() || undefined,
      note: note.trim() || undefined,
    };
    if (existing) await transactionRepo.update(existing.id, values);
    else await transactionRepo.create(values);
    onClose();
  }

  return (
    <form onSubmit={save} className={styles.form}>
      <div className={styles.segment} role="group" aria-label={t.finance.kind}>
        {(['expense', 'income'] as const).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
            {k === 'expense' ? t.finance.expenseOne : t.finance.incomeOne}
          </button>
        ))}
      </div>
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
          data-autofocus
        />
        <TextField
          label={t.form.date}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>
      <TextField label={t.finance.payee} value={payee} onChange={(e) => setPayee(e.target.value)} />
      <div className={styles.split}>
        <SelectField
          label={t.finance.account}
          value={accountId}
          onChange={(e) => setChosenAccountId(e.target.value)}
        >
          {data.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t.finance.category}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">{t.finance.noCategory}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
      </div>
      <TextArea label={t.form.note} value={note} onChange={(e) => setNote(e.target.value)} />
      {existing?.sourceRef ? <p className={styles.muted}>{t.finance.fromInvoice}</p> : null}
      <Actions
        onClose={onClose}
        onDelete={existing ? () => transactionRepo.remove(existing.id) : undefined}
      />
    </form>
  );
}

/* ------------------------------------ Account ------------------------------------ */

export type AccountTarget = Stored<Account> | { draft: true; order: number } | null;

export function AccountEditor({ target, onClose }: { target: AccountTarget; onClose: () => void }) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={existing ? t.finance.editAccount : t.finance.addAccount}
    >
      {target ? (
        <AccountForm key={existing?.id ?? 'new'} target={target} onClose={onClose} />
      ) : null}
    </Dialog>
  );
}

function AccountForm({
  target,
  onClose,
}: {
  target: NonNullable<AccountTarget>;
  onClose: () => void;
}) {
  const existing = 'id' in target ? target : null;
  const [name, setName] = useState(existing?.name ?? '');
  const [opening, setOpening] = useState(
    existing ? formatMoneyInput(existing.openingBalanceMinor) : '0,00',
  );
  const [error, setError] = useState('');

  async function save(e: FormEvent) {
    e.preventDefault();
    const openingBalanceMinor =
      opening.trim() === '' ? 0 : parseMoney(opening, { allowNegative: true });
    if (openingBalanceMinor === undefined) {
      setError(t.money.invalidAmount);
      return;
    }
    if (existing) await accountRepo.update(existing.id, { name: name.trim(), openingBalanceMinor });
    else
      await accountRepo.create({
        name: name.trim(),
        openingBalanceMinor,
        order: 'draft' in target ? target.order : 0,
      });
    onClose();
  }

  return (
    <form onSubmit={save} className={styles.form}>
      <TextField
        label={t.finance.accountName}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        data-autofocus
      />
      <TextField
        label={t.finance.openingBalance}
        inputMode="decimal"
        value={opening}
        onChange={(e) => {
          setOpening(e.target.value);
          setError('');
        }}
        error={error}
      />
      {existing ? <p className={styles.muted}>{t.finance.deleteAccountHint}</p> : null}
      <Actions
        onClose={onClose}
        onDelete={existing ? () => deleteAccount(existing.id) : undefined}
      />
    </form>
  );
}

/* ----------------------------------- Category ------------------------------------ */

export type CategoryTarget = Stored<Category> | { draft: true; kind: Kind } | null;

export function CategoryEditor({
  target,
  onClose,
}: {
  target: CategoryTarget;
  onClose: () => void;
}) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={existing ? t.finance.editCategory : t.finance.addCategory}
    >
      {target ? (
        <CategoryForm key={existing?.id ?? 'new'} target={target} onClose={onClose} />
      ) : null}
    </Dialog>
  );
}

function CategoryForm({
  target,
  onClose,
}: {
  target: NonNullable<CategoryTarget>;
  onClose: () => void;
}) {
  const existing = 'id' in target ? target : null;
  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<Kind>(
    existing?.kind ?? ('draft' in target ? target.kind : 'expense'),
  );

  async function save(e: FormEvent) {
    e.preventDefault();
    if (existing) await categoryRepo.update(existing.id, { name: name.trim(), kind });
    else await categoryRepo.create({ name: name.trim(), kind });
    onClose();
  }

  return (
    <form onSubmit={save} className={styles.form}>
      <TextField
        label={t.finance.categoryName}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        data-autofocus
      />
      <SelectField
        label={t.finance.kind}
        value={kind}
        onChange={(e) => setKind(e.target.value as Kind)}
      >
        <option value="expense">{t.finance.expenseOne}</option>
        <option value="income">{t.finance.incomeOne}</option>
      </SelectField>
      {existing ? <p className={styles.muted}>{t.finance.deleteCategoryHint}</p> : null}
      <Actions
        onClose={onClose}
        onDelete={existing ? () => categoryRepo.remove(existing.id) : undefined}
      />
    </form>
  );
}
