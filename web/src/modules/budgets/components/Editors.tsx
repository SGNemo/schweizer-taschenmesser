import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { formatMoney, formatMoneyInput, parseMoney } from '@/core/money';
import { today } from '@/core/time/dates';
import { t } from '@/strings';
import {
  Button,
  Dialog,
  Form,
  FormActions,
  Icon,
  IconButton,
  patternStyles,
  SelectField,
  Split,
  TextField,
} from '@/ui';
import { budgetRepo, deleteGoal, depositRepo, goalRepo } from '../repo';
import type { Budget, Deposit, Goal } from '../schema';

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
  onClose,
}: {
  target: BudgetTarget;
  categories: { id: string; name: string }[];
  /** Category ids that already have a budget. */
  taken: Set<string>;
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
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

function BudgetFields({
  existing,
  categories,
  onClose,
}: {
  existing: Stored<Budget> | null;
  categories: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? categories[0]?.id ?? '');
  const [limit, setLimit] = useState(existing ? formatMoneyInput(existing.monthlyLimitMinor) : '');
  const [error, setError] = useState('');

  async function save() {
    const monthlyLimitMinor = parseMoney(limit);
    if (!monthlyLimitMinor || monthlyLimitMinor < 1)
      return setError(t.money.invalidAmount(formatMoneyInput(1250)));
    if (!categoryId) return;
    if (existing) await budgetRepo.update(existing.id, { categoryId, monthlyLimitMinor });
    else await budgetRepo.create({ categoryId, monthlyLimitMinor });
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
            {c.name}
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
      <FormActions
        start={
          existing ? (
            <DeleteButton
              onDelete={async () => {
                await budgetRepo.remove(existing.id);
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
  const [target, setTarget] = useState(existing ? formatMoneyInput(existing.targetMinor) : '');
  const [deadline, setDeadline] = useState(existing?.deadline ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState('');

  async function save() {
    const targetMinor = parseMoney(target);
    if (!targetMinor || targetMinor < 1)
      return setError(t.money.invalidAmount(formatMoneyInput(1250)));
    const data = {
      name: name.trim(),
      targetMinor,
      deadline: deadline || undefined,
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
      <TextField label={t.form.note} value={note} onChange={(e) => setNote(e.target.value)} />
      <FormActions
        start={
          existing ? (
            <DeleteButton
              onDelete={async () => {
                await deleteGoal(existing.id);
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
                  {formatMoney(d.amountMinor)}
                </span>
                <IconButton
                  label={`${t.actions.delete}: ${d.date}`}
                  onClick={() => void depositRepo.remove(d.id)}
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
