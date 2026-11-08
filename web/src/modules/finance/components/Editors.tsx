import { useSubmitOnce } from '@/core/forms/submitOnce';
import { changedFields } from '@/core/db/patch';
import { compareText } from '@/core/i18n/format';
import { useState, type FormEvent } from 'react';
import type { Stored } from '@/core/db/types';
import {
  currencyOf,
  formatMoney,
  formatMoneyInput,
  isCurrencyCode,
  parseMoney,
} from '@/core/money';
import { formatDay, today } from '@/core/time/dates';
import { copyData } from '@/core/db/copy';
import { t } from '@/strings';
import { lastUsedFor, openingForBalance, splitsValid } from '../logic';
import { useFinanceData } from '../summary';
import { findPossibleDuplicate } from '../analysis';
import { CATEGORY_ICONS, categoryIcon } from '../categoryIcon';
import { SplitEditor, rowsToSplits, splitsToRows, type SplitRow } from './SplitEditor';
import {
  AdvancedFields,
  Button,
  CurrencyField,
  Dialog,
  Icon,
  patternStyles,
  Segmented,
  SelectField,
  TextArea,
  TextField,
} from '@/ui';
import { accountRepo, categoryRepo, deleteAccount, transactionRepo } from '../repo';
import {
  BOOKING_REPEATS,
  ACCOUNT_KINDS,
  type Account,
  type AccountKind,
  type BookingRepeat,
  type Category,
  type Transaction,
} from '../schema';
import type { FinanceData } from '../types';
import styles from '../routes/finance.module.css';
import { deleteWithUndo, undoableWithToast } from '@/core/undo/withToast';

type Kind = 'expense' | 'income';

const parentName = (cats: { id: string; name: string }[], id: string): string =>
  cats.find((c) => c.id === id)?.name ?? '';

function Actions({
  onDelete,
  onDuplicate,
  onClose,
}: {
  onDelete?: () => Promise<void>;
  onDuplicate?: () => Promise<void>;
  onClose: () => void;
}) {
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
      <span className={patternStyles.hstack}>
        {onDuplicate ? (
          <Button variant="ghost" onClick={() => void onDuplicate()}>
            {t.actions.duplicate}
          </Button>
        ) : null}
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
  onDuplicated,
}: {
  target: TransactionTarget;
  data: FinanceData;
  onClose: () => void;
  /** The copy made by "Duplizieren"; the page opens it for editing. */
  onDuplicated?: (copy: Stored<Transaction>) => void;
}) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      askAfterTyping
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
          onDuplicated={onDuplicated}
        />
      ) : null}
    </Dialog>
  );
}

function TransactionForm({
  existing,
  data,
  onClose,
  onDuplicated,
}: {
  existing: Stored<Transaction> | null;
  data: FinanceData;
  onClose: () => void;
  onDuplicated?: (copy: Stored<Transaction>) => void;
}) {
  const [kind, setKind] = useState<Kind>(existing?.kind ?? 'expense');
  // The record as the editor opened it: only fields that differ from it are saved (QA X01).
  const [opened] = useState(existing);
  const [amount, setAmount] = useState(existing ? formatMoneyInput(existing.amountMinor) : '');
  const [date, setDate] = useState(existing?.date ?? today());
  const [chosenAccountId, setChosenAccountId] = useState(existing?.accountId ?? '');
  // Falls back to the first account, which may only appear after the defaults were created.
  const accountId = chosenAccountId || data.accounts[0]?.id || '';
  const accountCurrency = currencyOf(data.accounts.find((a) => a.id === accountId));
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? '');
  // The category (and account) came from the payee's last booking, not from the user.
  const [autoFilled, setAutoFilled] = useState(false);
  const [payee, setPayee] = useState(existing?.payee ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [repeat, setRepeat] = useState<BookingRepeat | ''>(existing?.repeat ?? '');
  const [error, setError] = useState('');
  const [splitRows, setSplitRows] = useState<SplitRow[]>(
    existing?.splits?.length ? splitsToRows(existing.splits) : [],
  );
  const [dupAsked, setDupAsked] = useState(false);
  const categories = data.categories
    .filter((c) => c.kind === kind)
    .sort((a, b) => compareText(a.name, b.name));

  const draftAmount = parseMoney(amount);
  const twinNow =
    !existing && dupAsked && draftAmount
      ? findPossibleDuplicate(data.txs, { accountId, kind, amountMinor: draftAmount, date, payee })
      : undefined;

  async function save(e: FormEvent) {
    e.preventDefault();
    const amountMinor = parseMoney(amount);
    if (!amountMinor || amountMinor < 1) {
      setError(t.money.invalidAmount(formatMoneyInput(1250)));
      return;
    }
    if (!accountId) return;
    const splits = splitRows.length > 0 ? rowsToSplits(splitRows) : [];
    if (splitRows.length > 0 && !splitsValid(amountMinor, splits)) {
      const rest = amountMinor - splits.reduce((sum, p) => sum + p.amountMinor, 0);
      setError(
        rest > 0
          ? t.finance.ext.split.rest(formatMoney(rest, accountCurrency))
          : t.finance.ext.split.over(formatMoney(-rest, accountCurrency)),
      );
      return;
    }
    // A booking that looks like one already there: say so once, the second save goes through.
    const twin = existing
      ? undefined
      : findPossibleDuplicate(data.txs, { accountId, kind, amountMinor, date, payee });
    if (twin && !dupAsked) {
      setDupAsked(true);
      return;
    }
    const values = {
      accountId,
      categoryId: categories.some((c) => c.id === categoryId) ? categoryId : undefined,
      splits: splits.length > 0 ? splits : undefined,
      kind,
      amountMinor,
      date,
      payee: payee.trim() || undefined,
      note: note.trim() || undefined,
      repeat: repeat || undefined,
    };
    if (existing)
      await transactionRepo.update(existing.id, changedFields(opened ?? existing, values));
    else await transactionRepo.create(values);
    onClose();
  }

  // One save per submit: a double click or Enter + click never saves twice (QA X13).
  const saveOnce = useSubmitOnce(save);
  return (
    <form onSubmit={saveOnce} className={styles.form}>
      <Segmented
        label={t.finance.kind}
        value={kind}
        options={[
          { value: 'expense', label: t.finance.expenseOne },
          { value: 'income', label: t.finance.incomeOne },
        ]}
        onChange={setKind}
      />
      <div className={styles.split}>
        <TextField
          label={
            accountCurrency === 'EUR' ? t.money.amount : `${t.money.amount} (${accountCurrency})`
          }
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
      <TextField
        label={t.finance.payee}
        value={payee}
        onChange={(e) => {
          const value = e.target.value;
          setPayee(value);
          // A repeat booking only needs the amount: take category and account of the last one.
          if (!existing && (categoryId === '' || autoFilled)) {
            const last = lastUsedFor(data.txs, value, kind);
            setCategoryId(last?.categoryId ?? '');
            setAutoFilled(!!last?.categoryId);
            if (last && !chosenAccountId) setChosenAccountId(last.accountId);
          }
        }}
      />
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
        {splitRows.length === 0 ? (
          <SelectField
            label={t.finance.category}
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setAutoFilled(false);
            }}
          >
            <option value="">{t.finance.noCategory}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parentId ? `${parentName(data.categories, c.parentId)} › ${c.name}` : c.name}
              </option>
            ))}
          </SelectField>
        ) : (
          <p className={styles.muted}>{t.finance.ext.split.parts(splitRows.length)}</p>
        )}
      </div>
      {splitRows.length > 0 ? (
        <SplitEditor
          rows={splitRows}
          onChange={setSplitRows}
          totalMinor={draftAmount ?? 0}
          currency={accountCurrency}
          categories={categories.map((c) => ({
            id: c.id,
            name: c.parentId ? `${parentName(data.categories, c.parentId)} › ${c.name}` : c.name,
          }))}
        />
      ) : null}
      {twinNow ? (
        <p role="status" className={styles.muted}>
          {t.finance.ext.duplicateHint(twinNow.payee ?? '', formatDay(twinNow.date, 'P'))}
        </p>
      ) : null}
      <TextArea label={t.form.note} value={note} onChange={(e) => setNote(e.target.value)} />
      <AdvancedFields moduleId="finance" hasData={!!repeat || splitRows.length > 0}>
        {kind === 'expense' || splitRows.length > 0 ? (
          <Button
            variant="ghost"
            onClick={() =>
              setSplitRows(
                splitRows.length > 0
                  ? []
                  : [
                      { categoryId, amount: amount },
                      { categoryId: '', amount: '' },
                    ],
              )
            }
          >
            {splitRows.length > 0 ? t.finance.ext.split.off : t.finance.ext.split.toggle}
          </Button>
        ) : null}
        <SelectField
          label={t.finance.repeat}
          value={repeat}
          onChange={(e) => setRepeat(e.target.value as BookingRepeat | '')}
          hint={t.finance.repeatHint}
        >
          <option value="">{t.finance.repeatOptions.none}</option>
          {BOOKING_REPEATS.map((r) => (
            <option key={r} value={r}>
              {t.finance.repeatOptions[r]}
            </option>
          ))}
        </SelectField>
      </AdvancedFields>
      {existing?.sourceRef?.startsWith('subscription:') ? (
        <p className={styles.muted}>{t.finance.fromSubscription}</p>
      ) : existing?.sourceRef ? (
        <p className={styles.muted}>{t.finance.fromInvoice}</p>
      ) : null}
      <Actions
        onClose={onClose}
        onDelete={
          existing ? () => deleteWithUndo(() => transactionRepo.remove(existing.id)) : undefined
        }
        onDuplicate={
          existing
            ? async () => {
                // A repeat booking (rent, subscription) lands on today with the same payee and amount.
                const copy = await undoableWithToast(
                  t.actions.duplicated,
                  t.actions.duplicated,
                  () =>
                    transactionRepo.create({
                      ...copyData(existing),
                      date: today(),
                      sourceRef: undefined,
                      repeat: undefined,
                      repeatOf: undefined,
                    }),
                );
                onClose();
                onDuplicated?.(copy);
              }
            : undefined
        }
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
      askAfterTyping
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
  // The record as the editor opened it: only fields that differ from it are saved (QA X01).
  const [opened] = useState(existing);
  const [name, setName] = useState(existing?.name ?? '');
  const [opening, setOpening] = useState(
    existing ? formatMoneyInput(existing.openingBalanceMinor) : '0,00',
  );
  const [currency, setCurrency] = useState(currencyOf(existing));
  // Only for an account with bookings: "what the bank app says today" sets the opening balance (B06).
  const finance = useFinanceData();
  const accountTxs = existing
    ? (finance?.txs ?? []).filter((x) => x.accountId === existing.id)
    : [];
  const [balanceToday, setBalanceToday] = useState('');
  const [accountKind, setAccountKind] = useState<AccountKind | ''>(existing?.kind ?? '');
  const [error, setError] = useState('');

  async function save(e: FormEvent) {
    e.preventDefault();
    // A text of only spaces passes the field's `required` but not the schema: say so (QA X34).
    if (!name.trim()) {
      setError(t.form.required);
      return;
    }
    if (!isCurrencyCode(currency)) {
      setError(t.money.currencyInvalid);
      return;
    }
    const todayMinor =
      balanceToday.trim() === '' ? undefined : parseMoney(balanceToday, { allowNegative: true });
    if (balanceToday.trim() !== '' && todayMinor === undefined) {
      setError(t.money.invalidAmount(formatMoneyInput(1250)));
      return;
    }
    const openingBalanceMinor =
      todayMinor !== undefined
        ? openingForBalance(todayMinor, accountTxs, today())
        : opening.trim() === ''
          ? 0
          : parseMoney(opening, { allowNegative: true });
    if (openingBalanceMinor === undefined) {
      setError(t.money.invalidAmount(formatMoneyInput(1250)));
      return;
    }
    const stored = currency === 'EUR' ? undefined : currency;
    if (existing)
      await accountRepo.update(
        existing.id,
        changedFields(opened ?? existing, {
          name: name.trim(),
          openingBalanceMinor,
          currency: stored,
          kind: accountKind || undefined,
        }),
      );
    else
      await accountRepo.create({
        name: name.trim(),
        openingBalanceMinor,
        currency: stored,
        kind: accountKind || undefined,
        order: 'draft' in target ? target.order : 0,
      });
    onClose();
  }

  // One save per submit: a double click or Enter + click never saves twice (QA X13).
  const saveOnce = useSubmitOnce(save);
  return (
    <form onSubmit={saveOnce} className={styles.form}>
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
      {accountTxs.length > 0 ? (
        <TextField
          label={t.finance.balanceToday}
          hint={t.finance.balanceTodayHint}
          inputMode="decimal"
          value={balanceToday}
          onChange={(e) => {
            setBalanceToday(e.target.value);
            setError('');
          }}
        />
      ) : null}
      <SelectField
        label={t.finance.ext.accountKind.label}
        value={accountKind}
        onChange={(e) => setAccountKind(e.target.value as AccountKind | '')}
      >
        <option value="">–</option>
        {ACCOUNT_KINDS.map((k) => (
          <option key={k} value={k}>
            {t.finance.ext.accountKind[k]}
          </option>
        ))}
      </SelectField>
      <CurrencyField label={t.money.currency} value={currency} onChange={setCurrency} />
      {existing ? <p className={styles.muted}>{t.finance.deleteAccountHint}</p> : null}
      <Actions
        onClose={onClose}
        onDelete={existing ? () => deleteWithUndo(() => deleteAccount(existing.id)) : undefined}
      />
    </form>
  );
}

/* ----------------------------------- Category ------------------------------------ */

export type CategoryTarget =
  Stored<Category> | { draft: true; kind: Kind; parentId?: string } | null;

export function CategoryEditor({
  target,
  categories,
  onClose,
}: {
  target: CategoryTarget;
  /** All categories: the parent picker offers the top-level ones of the same kind. */
  categories: Stored<Category>[];
  onClose: () => void;
}) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      askAfterTyping
      open={target !== null}
      onClose={onClose}
      title={existing ? t.finance.editCategory : t.finance.addCategory}
    >
      {target ? (
        <CategoryForm
          key={existing?.id ?? 'new'}
          target={target}
          categories={categories}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

function CategoryForm({
  target,
  categories,
  onClose,
}: {
  target: NonNullable<CategoryTarget>;
  categories: Stored<Category>[];
  onClose: () => void;
}) {
  const existing = 'id' in target ? target : null;
  // The record as the editor opened it: only fields that differ from it are saved (QA X01).
  const [opened] = useState(existing);
  const [name, setName] = useState(existing?.name ?? '');
  const [nameError, setNameError] = useState('');
  const [kind, setKind] = useState<Kind>(
    existing?.kind ?? ('draft' in target ? target.kind : 'expense'),
  );

  const [parentId, setParentId] = useState(
    existing?.parentId ?? ('draft' in target ? (target.parentId ?? '') : ''),
  );
  const [icon, setIcon] = useState(existing?.icon ?? '');
  // One level only: a category with children cannot become a child itself.
  const hasChildren = existing ? categories.some((c) => c.parentId === existing.id) : false;
  const parents = categories
    .filter((c) => c.kind === kind && !c.parentId && c.id !== existing?.id)
    .sort((a, b) => compareText(a.name, b.name));

  async function save(e: FormEvent) {
    e.preventDefault();
    // A text of only spaces passes the field's `required` but not the schema: say so (QA X34).
    if (!name.trim()) {
      setNameError(t.form.required);
      return;
    }
    const values = {
      name: name.trim(),
      kind,
      parentId: parents.some((p) => p.id === parentId) ? parentId : undefined,
      icon: icon || undefined,
    };
    if (existing) await categoryRepo.update(existing.id, changedFields(opened ?? existing, values));
    else await categoryRepo.create(values);
    onClose();
  }

  // One save per submit: a double click or Enter + click never saves twice (QA X13).
  const saveOnce = useSubmitOnce(save);
  return (
    <form onSubmit={saveOnce} className={styles.form}>
      <TextField
        label={t.finance.categoryName}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setNameError('');
        }}
        error={nameError}
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
      {!hasChildren ? (
        <SelectField
          label={t.finance.ext.category.parent}
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
        >
          <option value="">{t.finance.ext.category.noParent}</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
      ) : null}
      <fieldset className={styles.iconPick}>
        <legend>{t.finance.ext.category.icon}</legend>
        <div role="radiogroup" aria-label={t.finance.ext.category.icon} className={styles.iconGrid}>
          <button
            type="button"
            role="radio"
            aria-checked={icon === ''}
            className={`${styles.iconChoice} ${icon === '' ? styles.iconChosen : ''}`}
            onClick={() => setIcon('')}
          >
            {t.finance.ext.category.iconAuto}
          </button>
          {CATEGORY_ICONS.map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={icon === i}
              aria-label={i}
              className={`${styles.iconChoice} ${icon === i ? styles.iconChosen : ''}`}
              onClick={() => setIcon(i)}
            >
              <Icon name={categoryIcon({ id: '', name: '', icon: i })} size={18} />
            </button>
          ))}
        </div>
      </fieldset>
      {existing ? <p className={styles.muted}>{t.finance.deleteCategoryHint}</p> : null}
      <Actions
        onClose={onClose}
        onDelete={
          existing ? () => deleteWithUndo(() => categoryRepo.remove(existing.id)) : undefined
        }
      />
    </form>
  );
}
