/** Re-exports of the budget arithmetic (see `compute.ts`), kept so existing imports keep working. */
export {
  budgetStatus,
  carryIn,
  DEFAULT_WARN_PERCENT,
  effectiveLimit,
  familyOf,
  goalPace,
  goalPlan,
  goalProgress,
  paceReachedOn,
  projectedSpend,
  spentInMonths,
  type BudgetStatus,
  type GoalPlan,
  type GoalProgress,
  type Tone,
} from './compute';
