import { useId, type ReactNode } from 'react';
import { dayName } from '@/core/plan/explain';
import { t } from '@/strings';
import { Card, Icon, ItemList, ItemRow } from '@/ui';
import type { BoardDay } from '../board';
import { compact } from './capacity';
import styles from '../routes/planner.module.css';

/** The appointments of the board's days that block time (from the calendar), in day order. */
export function appointmentsOf(days: readonly BoardDay[]) {
  return days.flatMap((d) =>
    d.blockers.filter((b) => b.calendar).map((b) => ({ ...b, date: d.date })),
  );
}

/**
 * What stands around the week (planner hub R1): the appointments of the seven days and, as `children`, the group
 * that waits for free time. Beside the sheet on a wide page, under it elsewhere. No appointments: no card.
 */
export function Context({
  days,
  before,
  children,
}: {
  days: readonly BoardDay[];
  /** The first card of the column („Frist vorbei“, R2). */
  before?: ReactNode;
  children?: ReactNode;
}) {
  const id = useId();
  const appointments = appointmentsOf(days);
  return (
    <div className={styles.context}>
      {before}
      {appointments.length > 0 ? (
        <Card className={styles.sheet} aria-labelledby={id} data-testid="planner-appointments">
          <h2 id={id} className={styles.cardHead}>
            {t.planner.ctx.appointments}
          </h2>
          <ItemList label={t.planner.ctx.appointments}>
            {appointments.map((a) => (
              <ItemRow
                key={`${a.date}-${a.id}`}
                lead={
                  <span className={styles.lead} aria-hidden="true">
                    <Icon name="calendar" size={20} />
                  </span>
                }
                title={a.label}
                meta={
                  <span className={styles.meta}>
                    <span>{a.from ? `${dayName(a.date)} ${a.from}` : dayName(a.date)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{compact(a.min)}</span>
                  </span>
                }
              />
            ))}
          </ItemList>
        </Card>
      ) : null}
      {children}
    </div>
  );
}
