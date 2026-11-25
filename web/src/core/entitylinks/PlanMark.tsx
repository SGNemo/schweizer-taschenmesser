/**
 * The mark „Im Plan · Mi“ (planner hub 2, hand-off 10, COPY M1–M6): one muted text link with the planner glyph that
 * leads to the plan row it matched (`planMarkRead.ts`). Nothing is drawn while loading, while the planner is off and when
 * the thing is not in the plan – no colour, no tone, no count.
 *
 *  - `variant="meta"`: a row's line – inside an `ItemRow` it goes into `below`, the line directly under the meta (the
 *    meta sits inside the row's button, and a link never nests in a button).
 *  - `variant="detail"`: its own line under the title block of a detail panel or dialog, 44 px high.
 *
 * Lists read all their rows at once with `usePlanMarks` and draw `PlanMarkLink`; a single thing uses `PlanMark`.
 */
import { Link } from 'react-router';
import { useSharedLiveQuery } from '@/core/modules/sharedQuery';
import { today } from '@/core/time/now';
import { Icon } from '@/ui/icons';
import {
  planMarkName,
  planMarkOf,
  planMarkPath,
  planMarks,
  planMarkText,
  type PlanMarkInput,
  type PlanMarkState,
} from './planMarkRead';
import styles from './PlanMark.module.css';

export type PlanMarkVariant = 'meta' | 'detail';

/** The mark of a read state; nothing for none. `onGo` runs before the route changes (a dialog closes itself). */
export function PlanMarkLink({
  state,
  variant = 'meta',
  onGo,
}: {
  state: PlanMarkState | null | undefined;
  variant?: PlanMarkVariant;
  onGo?: () => void;
}) {
  if (!state) return null;
  const day = today();
  return (
    <Link
      to={planMarkPath(state)}
      className={variant === 'detail' ? `${styles.mark} ${styles.detail}` : styles.mark}
      aria-label={planMarkName(state, day)}
      data-testid="plan-mark"
      data-plan={state.kind}
      onClick={onGo}
    >
      <Icon name="chartGantt" size={16} />
      <span className={styles.text}>{planMarkText(state, day)}</span>
    </Link>
  );
}

/**
 * The mark as plain words, for a list whose view broke its stimulus budget with a link and a glyph per row (ToDos):
 * „Im Plan · Mi“ in the row's meta line, no control of its own; the way to the planner is the row's ⋯ and its detail.
 */
export function PlanMarkWords({ state }: { state: PlanMarkState | null | undefined }) {
  if (!state) return null;
  return (
    <span data-testid="plan-mark" data-plan={state.kind}>
      {planMarkText(state)}
    </span>
  );
}

/** The live marks of a list's rows; `undefined` while loading or while the planner is off. */
export function usePlanMarks(
  module: string,
  things: readonly PlanMarkInput[],
): Map<string, PlanMarkState> | undefined {
  const sig = things
    .map((x) => `${x.id}${x.done ? '!' : ''}${x.fallback ? `+${x.fallbackKey ?? ''}` : ''}`)
    .sort()
    .join(',');
  return useSharedLiveQuery(`planMarks|${module}|${sig}`, () => planMarks(module, things));
}

/** The live mark of one thing (a detail panel, a single row). */
export function PlanMark({
  module,
  id,
  variant = 'meta',
  fallback,
  fallbackKey,
  done,
  onGo,
}: {
  module: string;
  id: string;
  variant?: PlanMarkVariant;
  /** The module's own „im Plan“ field: M3 while the planner has no row yet. */
  fallback?: boolean;
  /** The occurrence row the fallback stands for (`<module>:<id>:<date>`). */
  fallbackKey?: string;
  done?: boolean;
  onGo?: () => void;
}) {
  const state = useSharedLiveQuery(
    `planMark|${module}:${id}|${done ? 1 : 0}${fallback ? `1${fallbackKey ?? ''}` : 0}`,
    () =>
      planMarkOf(module, {
        id,
        ...(fallback ? { fallback, ...(fallbackKey ? { fallbackKey } : {}) } : {}),
        ...(done ? { done } : {}),
      }),
  );
  return <PlanMarkLink state={state} variant={variant} {...(onGo ? { onGo } : {})} />;
}
