import { useId } from 'react';
import type { DriveInfo } from '@/core/platform/disk';
import { t } from '@/strings';
import { Card } from '@/ui';
import { troubledDrives } from '../logic/advice';
import styles from './Advice.module.css';

/**
 * Above the drives, only when a built-in drive reports problems: one calm sentence per drive.
 * The card keeps that state folded under "Details", and it is the one thing on this page that
 * should not wait there. No button: the next step is the user's own backup. A PC that is fine
 * gets no block.
 */
export function Advice({ drives }: { drives: DriveInfo[] }) {
  const titleId = useId();
  const troubled = troubledDrives(drives);
  if (troubled.length === 0) return null;
  const a = t.disk.advice;
  return (
    <section className={styles.advice} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        {a.title}
      </h2>
      <Card as="div">
        <ul className={styles.list}>
          {troubled.map((d) => (
            <li key={d.root} className={styles.row}>
              {a.health(t.disk.driveName(d.root, d.label))}
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
