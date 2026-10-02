import type { ReactNode } from 'react';
import { Card, Ring, Sparkline, type RingLevel } from '@/ui';
import styles from './SystemTab.module.css';

/** One live tile: a ring or big value, a short line and a 5-minute sparkline. */
export function LiveTile({
  title,
  percent,
  level = 'ok',
  value,
  sub,
  series,
  seriesLabel,
  testId,
}: {
  title: string;
  /** Draws a ring when given; otherwise only `value` is shown. */
  percent?: number;
  level?: RingLevel;
  value: ReactNode;
  sub?: ReactNode;
  series?: readonly number[];
  seriesLabel?: string;
  testId?: string;
}) {
  return (
    <Card className={styles.tile} data-testid={testId}>
      <h3 className={styles.tileTitle}>{title}</h3>
      <div className={styles.tileMain}>
        {percent !== undefined ? <Ring percent={percent} level={level} label={title} /> : null}
        <div className={styles.tileText}>
          <p className={styles.tileValue}>{value}</p>
          {sub ? <p className={styles.sub}>{sub}</p> : null}
        </div>
      </div>
      {series && series.length > 1 ? (
        <Sparkline values={series} label={seriesLabel} width={200} height={32} />
      ) : null}
    </Card>
  );
}
