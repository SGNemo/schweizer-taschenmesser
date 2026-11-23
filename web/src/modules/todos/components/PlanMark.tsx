import { dayName } from '@/core/plan/explain';
import { dateTimeFormat } from '@/core/i18n/format';
import { t } from '@/strings';
import { dayWordOf, type PlanState } from '../planState';

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
 * Where a task stands in the plan, as plain words in the row's meta line while the planner is on (todos-plan-state):
 * „im Plan: Mi“, „im Plan: war Mo“, „noch nicht im Plan“, „nicht im Plan“, „… · fest“. No colour, no count, no line
 * and no button of its own – twenty tasks add no stimulus (the page's stimulus budget). The steps live in the row's ⋯:
 * „Im Planer zeigen“ (the planner on that day, the row in view) and „In den Plan …“.
 */
export function PlanWords({ state, day }: { state: PlanState; day: string }) {
  const text = planMarkText(state, day);
  if (!text) return null;
  const onDay = state.kind === 'planned' || state.kind === 'passed';
  return (
    <span data-testid={onDay ? 'in-plan' : 'plan-mark'} data-plan={state.kind}>
      {text}
    </span>
  );
}
