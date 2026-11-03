import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import {
  currencyOf,
  formatMoney,
  formatMoneyInput,
  isCurrencyCode,
  parseMoney,
} from '@/core/money';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { formatMonth, today } from '@/core/time/dates';
import { loadHistory } from '../data';
import styles from '../routes/budgets.module.css';
import { t } from '@/strings';
import {
  AdvancedFields,
  CurrencyField,
  Button,
  Dialog,
  Form,
  FormActions,
  Icon,
  IconButton,
  patternStyles,
  SelectField,
  Split,
  Switch,
  TextField,
} from '@/ui';
import { budgetRepo, deleteGoal, depositRepo, goalRepo } from '../repo';
import { BUDGET_PERIODS, type Budget, type BudgetPeriod, type Deposit, type Goal } from '../schema';
import { deleteWithUndo } from '@/core/undo/withToast';

function DeleteButton({ onDelete }: { onDelete: () => Promise<void> }) {
  return (
    <Button variant="danger" onClick={() => void onDelete()}>
      {t.actions.delete}
    </Button>
  );
}

/* ---------- Budget ---------- */

export type BudgetTarget = Stored<Budget> | { draft: true } | null;

export function BudgetEditor({
  target,
  categories,
  taken,
  month,
  onClose,
}: {
  target: BudgetTarget;
  categories: { id: string; name: string; parentId?: string }[];
  /** Category ids that already have a budget. */
  taken: Set<string>;
  /** The month shown on the page: the history ends with its period. */
  month: string;
  onClose: () => void;
}) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={existing ? t.budgets.editBudget : t.budgets.addBudget}
    >
      {target ? (
        <BudgetFields
          key={existing?.id ?? 'new'}
          existing={existing}
          categories={categories.filter((c) => c.id === existing?.categoryId || !taken.has(c.id))}
          allCategories={categories}
          month={month}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

function BudgetFields({
  existing,
  categories,
  allCategories,
  month,
  onClose,
}: {
  existing: Stored<Budget> | null;
  categories: { id: string; name: string; parentId?: string }[];
  allCategories: { id: string; name: string; parentId?: string }[];
  month: string;
  onClose: () => void;
}) {
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? categories[0]?.id ?? '');
  const [currency, setCurrency] = useState(currencyOf(existing));
  const [limit, setLimit] = useState(existing ? formatMoneyInput(existing.monthlyLimitMinor) : '');
  const [period, setPeriod] = useState<BudgetPeriod>(existing?.period ?? 'month');
  const [carryOver, setCarryOver] = useState(existing?.carryOver ?? false);
  const [warnAt, setWarnAt] = useState(
    existing?.warnAtPercent ? String(existing.warnAtPercent) : '',
  );
  const [error, setError] = useState('');
  const parentName = (id?: string) => allCategories.find((c) => c.id === id)?.name ?? '';

  async function save() {
    const monthlyLimitMinor = parseMoney(limit);
    if (!monthlyLimitMinor || monthlyLimitMinor < 1)
      return setError(t.money.invalidAmount(formatMoneyInput(1250)));
    if (!isCurrencyCode(currency)) return setError(t.money.currencyInvalid);
    if (!categoryId) return;
    const warn = Number(warnAt);
    const data = {
      categoryId,
      monthlyLimitMinor,
      currency: currency === 'EUR' ? undefined : currency,
      period: period === 'month' ? undefined : period,
      carryOver: carryOver || undefined,
      warnAtPercent:
        warnAt.trim() !== '' && warn >= 10 && warn <= 99 ? Math.round(warn) : undefined,
    };
    if (existing) await budgetRepo.update(existing.id, data);
    else await budgetRepo.create(data);
    onClose();
  }

  return (
    <Form onSubmit={() => void save()}>
      <SelectField
        label={t.budgets.category}
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        required
        data-autofocus
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.parentId ? `${parentName(c.parentId)} › ${c.name}` : c.name}
          </option>
        ))}
      </SelectField>
      <TextField
        label={t.budgets.limit}
        inputMode="decimal"
        placeholder="0,00"
        value={limit}
        onChange={(e) => {
          setLimit(e.target.value);
          setError('');
        }}
        error={error}
        required
      />
      <AdvancedFields
        moduleId="budgets"
        hasData={period !== 'month' || carryOver || warnAt !== '' || currencyOf(existing) !== 'EUR'}
      >
        <SelectField
          label={t.budgets.ext.period.label}
          value={period}
          onChange={(e) => setPeriod(e.target.value as BudgetPeriod)}
        >
          {BUDGET_PERIODS.map((p) => (
            <option key={p} value={p}>
              {t.budgets.ext.period[p]}
            </option>
          ))}
        </SelectField>
        <Switch label={t.budgets.ext.carry.label} checked={carryOver} onChange={setCarryOver} />
        <p className={patternStyles.muted}>{t.budgets.ext.carry.hint}</p>
        <TextField
          label={t.budgets.ext.warn.label}
          inputMode="numeric"
          placeholder="80"
          value={warnAt}
          onChange={(e) => setWarnAt(e.target.value.replace(/\D/g, '').slice(0, 2))}
          hint={t.budgets.ext.warn.hint}
        />
        <CurrencyField label={t.money.currency} value={currency} onChange={setCurrency} />
      </AdvancedFields>
      {existing ? (
        <BudgetHistory budget={existing} month={month} categories={allCategories} />
      ) : null}
      <FormActions
        start={
          existing ? (
            <DeleteButton
              onDelete={async () => {
                await deleteWithUndo(() => budgetRepo.remove(existing.id));
                onClose();
              }}
            />
          ) : undefined
        }
      >
        <Button onClick={onClose}>{t.actions.cancel}</Button>
        <Button type="submit" variant="primary" disabled={!categoryId}>
          {t.actions.save}
        </Button>
      </FormActions>
    </Form>
  );
}

/** The last six periods of a budget: what each spent against the limit, with a link to the bookings of its last month. */
function BudgetHistory({
  budget,
  month,
  categories,
}: {
  budget: Stored<Budget>;
  month: string;
  categories: { id: string; name: string; parentId?: string }[];
}) {
  const rows = useLiveQuery(
    () => loadHistory(budget, month, categories),
    [budget, month, categories],
  );
  const cur = currencyOf(budget);
  const e = t.budgets.ext;
  if (!rows) return null;
  return (
    <section aria-label={e.history.title} data-testid="budget-history">
      <h3 className={styles.historyTitle}>{e.history.title}</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{e.history.period}</th>
            <th scope="col">{e.history.spent}</th>
            <th scope="col">{e.history.limit}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.info.months[0]}>
              <th scope="row">
                {r.info.period === 'quarter'
                  ? e.period.quarterLabel(r.info.index, r.info.year)
                  : r.info.period === 'year'
                    ? String(r.info.year)
                    : formatMonth(r.month)}
              </th>
              <td>{formatMoney(r.spent, cur)}</td>
              <td>{formatMoney(budget.monthlyLimitMinor, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Link
        to={`/finance?tab=transactions&month=${rows[rows.length - 1]?.info.months.at(-1) ?? month}`}
      >
        {e.history.bookings}
      </Link>
    </section>
  );
}

/* ---------- Goal ---------- */

export type GoalTarget = Stored<Goal> | { draft: true } | null;

export function GoalEditor({ target, onClose }: { target: GoalTarget; onClose: () => void }) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={existing ? t.budgets.editGoal : t.budgets.addGoal}
    >
      {target ? (
        <GoalFields key={existing?.id ?? 'new'} existing={existing} onClose={onClose} />
      ) : null}
    </Dialog>
  );
}

function GoalFields({ existing, onClose }: { existing: Stored<Goal> | null; onClose: () => void }) {
  const [name, setName] = useState(existing?.name ?? '');
  const [currency, setCurrency] = useState(currencyOf(existing));
  const [target, setTarget] = useState(existing ? formatMoneyInput(existing.targetMinor) : '');
  const [deadline, setDeadline] = useState(existing?.deadline ?? '');
  const [rate, setRate] = useState(
    existing?.monthlyRateMinor ? formatMoneyInput(existing.monthlyRateMinor) : '',
  );
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState('');

  async function save() {
    const targetMinor = parseMoney(target);
    if (!targetMinor || targetMinor < 1)
      return setError(t.money.invalidAmount(formatMoneyInput(1250)));
    if (!isCurrencyCode(currency)) return setError(t.money.currencyInvalid);
    const data = {
      name: name.trim(),
      targetMinor,
      currency: currency === 'EUR' ? undefined : currency,
      deadline: deadline || undefined,
      monthlyRateMinor: parseMoney(rate) || undefined,
      note: note.trim() || undefined,
    };
    if (existing) await goalRepo.update(existing.id, data);
    else await goalRepo.create(data);
    onClose();
  }

  return (
    <Form onSubmit={() => void save()}>
      <TextField
        label={t.budgets.goalName}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        data-autofocus
      />
      <Split>
        <TextField
          label={t.budgets.target}
          inputMode="decimal"
          placeholder="0,00"
          value={target}
          onChange={(e) => {
            setTarget(e.target.value);
            setError('');
          }}
          error={error}
          required
        />
        <TextField
          label={t.budgets.deadline}
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </Split>
      <AdvancedFields moduleId="budgets" hasData={rate !== '' || currencyOf(existing) !== 'EUR'}>
        <TextField
          label={t.budgets.ext.goal.rate}
          inputMode="decimal"
          placeholder="0,00"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          hint={t.budgets.ext.goal.rateHint}
        />
        <CurrencyField label={t.money.currency} value={currency} onChange={setCurrency} />
      </AdvancedFields>
      <TextField label={t.form.note} value={note} onChange={(e) => setNote(e.target.value)} />
      <FormActions
        start={
          existing ? (
            <DeleteButton
              onDelete={async () => {
                await deleteWithUndo(() => deleteGoal(existing.id));
                onClose();
              }}
            />
          ) : undefined
        }
      >
        <Button onClick={onClose}>{t.actions.cancel}</Button>
        <Button type="submit" variant="primary">
          {t.actions.save}
        </Button>
      </FormActions>
    </Form>
  );
}

/* ---------- Deposit ---------- */

export function DepositDialog({
  goal,
  onClose,
}: {
  goal: Stored<Goal> | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={goal !== null}
      onClose={onClose}
      title={goal ? t.budgets.depositTitle(goal.name) : ''}
    >
      {goal ? <DepositFields key={goal.id} goal={goal} onClose={onClose} /> : null}
    </Dialog>
  );
}

function DepositFields({ goal, onClose }: { goal: Stored<Goal>; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [withdraw, setWithdraw] = useState(false);
  const [date, setDate] = useState(today());
  const [error, setError] = useState('');

  async function save() {
    const cents = parseMoney(amount);
    if (!cents || cents < 1) return setError(t.money.invalidAmount(formatMoneyInput(1250)));
    await depositRepo.create({
      goalId: goal.id,
      amountMinor: withdraw ? -cents : cents,
      date,
    });
    onClose();
  }

  return (
    <Form onSubmit={() => void save()}>
      <Split>
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
        />
      </Split>
      <SelectField
        label={t.budgets.kind}
        value={withdraw ? 'out' : 'in'}
        onChange={(e) => setWithdraw(e.target.value === 'out')}
      >
        <option value="in">{t.budgets.depositIn}</option>
        <option value="out">{t.budgets.depositOut}</option>
      </SelectField>
      <FormActions>
        <Button onClick={onClose}>{t.actions.cancel}</Button>
        <Button type="submit" variant="primary">
          {t.actions.save}
        </Button>
      </FormActions>
    </Form>
  );
}

/* ---------- Deposit history ---------- */

export function HistoryDialog({
  goal,
  deposits,
  onClose,
}: {
  goal: Stored<Goal> | null;
  deposits: Stored<Deposit>[];
  onClose: () => void;
}) {
  return (
    <Dialog
      open={goal !== null}
      onClose={onClose}
      title={goal ? t.budgets.historyTitle(goal.name) : ''}
    >
      {goal ? (
        deposits.length === 0 ? (
          <p>{t.budgets.noDeposits}</p>
        ) : (
          <ul className={patternStyles.plainList}>
            {deposits.map((d) => (
              <li
                key={d.id}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}
              >
                <span className={patternStyles.grow}>{d.date.split('-').reverse().join('.')}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatMoney(d.amountMinor, currencyOf(goal))}
                </span>
                <IconButton
                  label={`${t.actions.delete}: ${d.date}`}
                  onClick={() => void deleteWithUndo(() => depositRepo.remove(d.id))}
                >
                  <Icon name="trash" />
                </IconButton>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </Dialog>
  );
}
