import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import type { Stored } from '@/core/db/types';
import { formatMoney } from '@/core/money';
import { addMonthsToMonth, formatDay, formatMonth, monthOf, today } from '@/core/time/dates';
import { StartDataButton } from '@/core/importer/StartDataButton';
import { t } from '@/strings';
import {
  Button,
  Card,
  EmptyState,
  Icon,
  IconButton,
  ItemList,
  PageHeader,
  Progress,
  Segmented,
  Stat,
  patternStyles,
} from '@/ui';
import { useBudgetData } from '../data';
import {
  BudgetEditor,
  DepositDialog,
  GoalEditor,
  HistoryDialog,
  type BudgetTarget,
  type GoalTarget,
} from '../components/Editors';
import { budgetStatus, goalProgress } from '../logic';
import { depositRepo, goalRepo } from '../repo';
import type { Goal } from '../schema';

type Tab = 'budgets' | 'goals';

export default function BudgetsPage() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'goals' ? 'goals' : 'budgets');
  const [month, setMonth] = useState(monthOf(today()));
  const { data, financeOn, loading } = useBudgetData(month);
  const goals = useLiveQuery(
    async () => (await goalRepo.active().toArray()).sort((a, b) => a.createdAt - b.createdAt),
    [],
  );
  const deposits = useLiveQuery(() => depositRepo.active().toArray(), []);
  const [budgetTarget, setBudgetTarget] = useState<BudgetTarget>(null);
  const [goalTarget, setGoalTarget] = useState<GoalTarget>(null);
  const [depositFor, setDepositFor] = useState<Stored<Goal> | null>(null);
  const [historyFor, setHistoryFor] = useState<Stored<Goal> | null>(null);
  const day = today();

  // `?new=1` (Quick-Add) opens the create dialog of the current tab.
  const wantsNew = params.get('new');
  const openGoal = goalTarget ?? (wantsNew && tab === 'goals' ? { draft: true as const } : null);
  const openBudget =
    budgetTarget ?? (wantsNew && tab === 'budgets' ? { draft: true as const } : null);
  const clearNew = () => wantsNew && setParams({}, { replace: true });

  const categories = data?.categories ?? [];
  const categoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? t.budgets.unknownCategory;
  const taken = new Set((data?.budgets ?? []).map((b) => b.categoryId));
  const budgets = (data?.budgets ?? []).sort((a, b) =>
    categoryName(a.categoryId).localeCompare(categoryName(b.categoryId), 'de'),
  );
  const canAddBudget = Boolean(financeOn) && categories.some((c) => !taken.has(c.id));

  return (
    <>
      <PageHeader title={t.budgets.title}>
        {tab === 'budgets' ? (
          <Button
            variant="primary"
            disabled={!canAddBudget}
            onClick={() => setBudgetTarget({ draft: true })}
          >
            <Icon name="plus" size={18} />
            {t.budgets.addBudget}
          </Button>
        ) : (
          <Button variant="primary" onClick={() => setGoalTarget({ draft: true })}>
            <Icon name="plus" size={18} />
            {t.budgets.addGoal}
          </Button>
        )}
      </PageHeader>
      <div className={patternStyles.gapBottom}>
        <Segmented
          label={t.budgets.tabs}
          value={tab}
          options={[
            { value: 'budgets', label: t.budgets.tabBudgets },
            { value: 'goals', label: t.budgets.tabGoals },
          ]}
          onChange={setTab}
        />
      </div>

      {tab === 'budgets' ? (
        <>
          {!loading && !financeOn ? (
            <EmptyState title={t.budgets.needFinance}>
              <p>{t.budgets.needFinanceHint}</p>
            </EmptyState>
          ) : (
            <>
              <div className={patternStyles.toolbar}>
                <IconButton
                  label={t.budgets.prevMonth}
                  onClick={() => setMonth(addMonthsToMonth(month, -1))}
                >
                  <span aria-hidden="true">‹</span>
                </IconButton>
                <strong aria-live="polite">{formatMonth(month)}</strong>
                <IconButton
                  label={t.budgets.nextMonth}
                  onClick={() => setMonth(addMonthsToMonth(month, 1))}
                >
                  <span aria-hidden="true">›</span>
                </IconButton>
              </div>
              {data && budgets.length === 0 ? (
                <EmptyState title={t.budgets.emptyBudgets}>
                  <StartDataButton moduleId="budgets" />
                </EmptyState>
              ) : null}
              <ItemList layout="grid" label={t.budgets.tabBudgets}>
                {budgets.map((b) => {
                  const s = budgetStatus(b.monthlyLimitMinor, data?.spent.get(b.categoryId) ?? 0);
                  return (
                    <Card as="li" key={b.id}>
                      <div className={patternStyles.row}>
                        <button
                          type="button"
                          className={patternStyles.main}
                          onClick={() => setBudgetTarget(b)}
                        >
                          <span className={patternStyles.title}>{categoryName(b.categoryId)}</span>
                          <span
                            className={
                              s.tone === 'over' ? patternStyles.overdue : patternStyles.muted
                            }
                          >
                            {t.budgets.spentOf(formatMoney(s.spent), formatMoney(s.limit))}
                            {' · '}
                            {s.remaining >= 0
                              ? t.budgets.left(formatMoney(s.remaining))
                              : t.budgets.over(formatMoney(-s.remaining))}
                          </span>
                        </button>
                        <span>{s.pct} %</span>
                      </div>
                      <Progress
                        value={s.spent}
                        max={s.limit}
                        label={categoryName(b.categoryId)}
                        over={s.tone === 'over'}
                      />
                    </Card>
                  );
                })}
              </ItemList>
            </>
          )}
        </>
      ) : (
        <>
          {goals && goals.length === 0 ? <EmptyState title={t.budgets.emptyGoals} /> : null}
          <ItemList layout="grid" label={t.budgets.tabGoals}>
            {(goals ?? []).map((g) => {
              const own = (deposits ?? []).filter((d) => d.goalId === g.id);
              const p = goalProgress(g, own, day);
              return (
                <Card as="li" key={g.id}>
                  <div className={patternStyles.row}>
                    <button
                      type="button"
                      className={patternStyles.main}
                      onClick={() => setGoalTarget(g)}
                    >
                      <span className={patternStyles.title}>{g.name}</span>
                      <span className={patternStyles.muted}>
                        {formatMoney(p.saved)} / {formatMoney(g.targetMinor)}
                        {g.deadline
                          ? ` · ${t.budgets.until(formatDay(g.deadline, 'd. MMM yyyy'))}`
                          : ''}
                      </span>
                    </button>
                    <Stat
                      label={p.reached ? t.budgets.reached : t.budgets.remaining}
                      value={p.reached ? '✓' : formatMoney(p.remaining)}
                    />
                  </div>
                  <Progress value={p.saved} max={g.targetMinor} label={g.name} />
                  {p.perMonth !== undefined ? (
                    <p className={patternStyles.muted}>
                      {t.budgets.perMonth(formatMoney(p.perMonth))}
                    </p>
                  ) : null}
                  <div className={patternStyles.row} style={{ marginTop: 'var(--space-2)' }}>
                    <Button onClick={() => setDepositFor(g)}>{t.budgets.deposit}</Button>
                    <Button variant="ghost" onClick={() => setHistoryFor(g)}>
                      {t.budgets.history}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </ItemList>
        </>
      )}

      <BudgetEditor
        target={openBudget}
        categories={categories}
        taken={taken}
        onClose={() => {
          setBudgetTarget(null);
          clearNew();
        }}
      />
      <GoalEditor
        target={openGoal}
        onClose={() => {
          setGoalTarget(null);
          clearNew();
        }}
      />
      <DepositDialog goal={depositFor} onClose={() => setDepositFor(null)} />
      <HistoryDialog
        goal={historyFor}
        deposits={(deposits ?? [])
          .filter((d) => d.goalId === historyFor?.id)
          .sort((a, b) => b.date.localeCompare(a.date))}
        onClose={() => setHistoryFor(null)}
      />
    </>
  );
}
