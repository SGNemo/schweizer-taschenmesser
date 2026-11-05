import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import type { Stored } from '@/core/db/types';
import { currencyOf, formatMoney, DEFAULT_CURRENCY } from '@/core/money';
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
  patternStyles,
  Progress,
  Segmented,
  Stat,
  useOpenParam,
} from '@/ui';
import { useBudgetData } from '../data';
import { HeroFigure, HeroSlot } from '@/ui/identity';
import { EnvelopeMini } from '../components/Envelope';
import styles from './budgets.module.css';
import {
  BudgetEditor,
  DepositDialog,
  GoalEditor,
  HistoryDialog,
  type BudgetTarget,
  type GoalTarget,
} from '../components/Editors';
import { goalPace, goalPlan, goalProgress, paceReachedOn } from '../compute';
import { budgetRepo, depositRepo, goalRepo } from '../repo';
import type { Goal } from '../schema';

// comfort-custom-row: budgets and goals are progress cards (bar, deposit buttons), not one-line rows.
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
  useOpenParam((id) => budgetRepo.get(id), setBudgetTarget);
  const [goalTarget, setGoalTarget] = useState<GoalTarget>(null);
  useOpenParam((id) => goalRepo.get(id), setGoalTarget);
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
  const rows = [...(data?.rows ?? [])].sort((a, b) =>
    categoryName(a.budget.categoryId).localeCompare(categoryName(b.budget.categoryId), 'de'),
  );
  const budgets = rows.map((r) => r.budget);
  // The head: what is still free in the main currency and where the spending went (decoration; the cards carry every number).
  const mainCurrency = rows.some((r) => currencyOf(r.budget) === DEFAULT_CURRENCY)
    ? DEFAULT_CURRENCY
    : rows[0] && currencyOf(rows[0].budget);
  const inMain = rows.filter((r) => currencyOf(r.budget) === mainCurrency);
  const free = inMain.reduce((sum, r) => sum + Math.max(0, r.limit - r.spent), 0);
  const overCount = inMain.filter((r) => r.status.tone === 'over').length;
  const canAddBudget = Boolean(financeOn) && categories.some((c) => !taken.has(c.id));

  return (
    <>
      <PageHeader
        title={t.budgets.title}
        views={
          <Segmented
            label={t.budgets.tabs}
            value={tab}
            options={[
              { value: 'budgets', label: t.budgets.tabBudgets },
              { value: 'goals', label: t.budgets.tabGoals },
            ]}
            onChange={setTab}
          />
        }
      >
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
      {tab === 'budgets' && data && inMain.length > 0 && mainCurrency ? (
        <>
          <HeroSlot area="figure">
            <HeroFigure
              label={t.budgets.ext.head.free}
              value={formatMoney(free, mainCurrency)}
              detail={t.budgets.ext.head.context(inMain.length, overCount)}
              testId="budgets-free"
            />
          </HeroSlot>
          {inMain.length > 0 ? (
            <HeroSlot area="signature">
              <div className={styles.headEnvelopes}>
                {[...inMain]
                  .sort((x, y) => y.status.pct - x.status.pct)
                  .slice(0, 3)
                  .map((r) => (
                    <EnvelopeMini
                      key={r.budget.id}
                      name={categoryName(r.budget.categoryId)}
                      pct={r.status.pct}
                      over={r.status.tone === 'over'}
                    />
                  ))}
              </div>
            </HeroSlot>
          ) : null}
        </>
      ) : null}

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
                {rows.map((r) => {
                  const b = r.budget;
                  const s = r.status;
                  const cur = currencyOf(b);
                  const periodText =
                    r.period === 'quarter'
                      ? t.budgets.ext.period.quarterLabel(r.info.index, r.info.year)
                      : r.period === 'year'
                        ? String(r.info.year)
                        : '';
                  const carryText =
                    r.carry > 0
                      ? t.budgets.ext.carry.plus(formatMoney(r.carry, cur))
                      : r.carry < 0
                        ? t.budgets.ext.carry.minus(formatMoney(-r.carry, cur))
                        : '';
                  // Only a forecast that lands above the limit is worth a line (calm: no line while it looks fine).
                  const forecast =
                    r.projected !== undefined && s.tone !== 'over' && r.projected > r.limit
                      ? t.budgets.ext.forecast.over(formatMoney(r.projected - r.limit, cur))
                      : undefined;
                  return (
                    <Card as="li" key={b.id} className={styles.envelope}>
                      <span
                        className={`${styles.level} ${s.tone === 'over' ? styles.levelOver : ''}`}
                        style={{ height: `${Math.min(100, s.pct)}%` }}
                        aria-hidden="true"
                      />
                      <span className={styles.flap} aria-hidden="true" />
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
                            {t.budgets.spentOf(
                              formatMoney(s.spent, cur),
                              formatMoney(s.limit, cur),
                            )}
                            {' · '}
                            {s.remaining >= 0
                              ? t.budgets.left(formatMoney(s.remaining, cur))
                              : t.budgets.over(formatMoney(-s.remaining, cur))}
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
                      {periodText || carryText ? (
                        <p className={styles.note}>
                          {[periodText, carryText].filter(Boolean).join(' · ')}
                        </p>
                      ) : null}
                      {forecast ? (
                        <p className={styles.warnNote} data-testid="forecast-line">
                          {forecast}
                        </p>
                      ) : null}
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
                        {formatMoney(p.saved, currencyOf(g))} /{' '}
                        {formatMoney(g.targetMinor, currencyOf(g))}
                        {g.deadline
                          ? ` · ${t.budgets.until(formatDay(g.deadline, 'd. MMM yyyy'))}`
                          : ''}
                      </span>
                    </button>
                    <Stat
                      label={p.reached ? t.budgets.reached : t.budgets.remaining}
                      value={p.reached ? '✓' : formatMoney(p.remaining, currencyOf(g))}
                    />
                  </div>
                  <Progress value={p.saved} max={g.targetMinor} label={g.name} />
                  {p.perMonth !== undefined ? (
                    <p className={patternStyles.muted}>
                      {t.budgets.perMonth(formatMoney(p.perMonth, currencyOf(g)))}
                    </p>
                  ) : null}
                  {(() => {
                    const plan = goalPlan(g, p.saved, day);
                    if (!plan || !g.monthlyRateMinor) return null;
                    return (
                      <p className={patternStyles.muted} data-testid="goal-plan">
                        {t.budgets.ext.goal.plan(
                          formatMoney(g.monthlyRateMinor, currencyOf(g)),
                          formatDay(plan.reachedOn, 'LLLL yyyy'),
                        )}{' '}
                        {g.deadline
                          ? plan.monthsLate > 0
                            ? t.budgets.ext.goal.late(plan.monthsLate)
                            : t.budgets.ext.goal.inTime
                          : ''}
                      </p>
                    );
                  })()}
                  {(() => {
                    const pace = goalPace(g, p.saved, day);
                    if (pace === undefined) return null;
                    const reach = g.monthlyRateMinor
                      ? undefined
                      : paceReachedOn(g, p.saved, pace, day);
                    return (
                      <p className={patternStyles.muted} data-testid="goal-pace">
                        {t.budgets.ext.goal.pace(formatMoney(pace, currencyOf(g)))}{' '}
                        {reach ? t.budgets.ext.goal.paceReach(formatDay(reach, 'LLLL yyyy')) : ''}
                      </p>
                    );
                  })()}
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
        month={month}
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
