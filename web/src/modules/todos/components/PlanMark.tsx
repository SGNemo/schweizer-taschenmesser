import { dayName } from '@/core/plan/explain';
import { dateTimeFormat } from '@/core/i18n/format';
import { t } from '@/strings';
import { dayWordOf, type PlanState } from '../planState';
import styles from '../routes/todos.module.css';

/** „heute“, „Mi“ or „Mi 2.12.“ – the planner's day names, a later day with its date. */
export function planDayLabel(date: string, day: string): string {
  const word = dayWordOf(date, day);
  if (word.kind === 'today') return t.todos.plan.today;
  if (word.kind === 'weekday') return dayName(date);
  const short = dateTimeFormat({ day: 'numeric', month: 'numeric' }).format(
    new Date(`${date}T12:00:00`),
  );
  return `${dayName(date)} ${short}`;
}

/** The visible words of a mark; empty for none. */
export function planMarkText(state: PlanState, day: string): string {
  const p = t.todos.plan;
  switch (state.kind) {
    case 'none':
      return '';
    case 'unplanned':
      return p.unplanned;
    case 'excluded':
      return p.excluded;
    case 'planned': {
      const label = t.todos.inPlan(planDayLabel(state.date, day));
      return state.locked ? p.locked(label) : label;
    }
    case 'passed': {
      const label = p.passed(planDayLabel(state.date, day));
      return state.locked ? p.locked(label) : label;
    }
  }
}

/**
 * The quiet line under a task while the planner is on (todos-plan-state): where it stands in the plan. No colour, no
 * count, the planner's words. A day leads into the planner with the row in view; „noch nicht im Plan“ opens
 * „In den Plan …“ (the next step); „nicht im Plan“ („Nicht planen“, decided in the planner) is plain text.
 */
export function PlanMark({
  state,
  day,
  title,
  onShow,
  onChoose,
}: {
  state: PlanState;
  day: string;
  title: string;
  onShow: () => void;
  onChoose: () => void;
}) {
  const text = planMarkText(state, day);
  if (!text) return null;
  if (state.kind === 'excluded')
    return (
      <span className={styles.planMark} data-testid="plan-mark" data-plan={state.kind}>
        {text}
      </span>
    );
  const show = state.kind === 'planned' || state.kind === 'passed';
  return (
    <button
      type="button"
      className={styles.planMark}
      data-testid={show ? 'in-plan' : 'plan-mark'}
      data-plan={state.kind}
      aria-label={show ? t.todos.plan.show(text) : t.todos.plan.choose(text, title)}
      onClick={show ? onShow : onChoose}
    >
      {text}
    </button>
  );
}
