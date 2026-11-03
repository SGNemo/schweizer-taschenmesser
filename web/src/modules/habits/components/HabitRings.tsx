import type { Stored } from '@/core/db/types';
import { Ring } from '@/ui';
import { dayProgress, isScheduled } from '../logic';
import type { Entry, Goal } from '../schema';
import styles from '../habits.module.css';

/**
 * Signature of the head: one still ring per goal planned today, with its name under it. The
 * numbers inside are text; nothing moves. A rest day shows an empty ring (it counts for nothing).
 */
export function HabitRings({
  goals,
  today,
  day,
}: {
  goals: Stored<Goal>[];
  today: ReadonlyMap<string, Entry>;
  day: string;
}) {
  const planned = goals.filter((g) => isScheduled(g, day));
  if (planned.length === 0) return null;
  return (
    <div className={styles.headRings} data-testid="habit-rings">
      {planned.map((g) => {
        const entry = today.get(g.id);
        return (
          <span key={g.id} className={`${styles.headRing} ${styles.ringHue}`}>
            <Ring percent={Math.round(dayProgress(g, entry) * 100)} size="sm" label={g.name}>
              {g.kind === 'count' ? (entry?.count ?? 0) : (entry?.count ?? 0) >= 1 ? '✓' : ''}
            </Ring>
            <span>{g.name}</span>
          </span>
        );
      })}
    </div>
  );
}
