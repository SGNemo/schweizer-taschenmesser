import { useState, type ReactNode } from 'react';
import { t } from '@/strings';
import styles from './settings.module.css';

/**
 * One group of settings shown as a single line with the current choice ("Thema: Hell · Ändern");
 * the pickers appear only once it is opened. A deep link opens the surrounding `<details>` itself
 * (SettingsLayout), so `onToggle` keeps the label and `aria-expanded` in step with the real state.
 */
export function FoldedGroup({
  id,
  title,
  current,
  children,
}: {
  id: string;
  title: string;
  /** The values chosen right now, in the order of the pickers. */
  current: string[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const g = t.settings.appearanceGroups;
  return (
    <details
      className={styles.group}
      data-testid={`appearance-group-${id}`}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className={styles.groupSummary} aria-expanded={open}>
        <span className={styles.groupLine}>{g.line(title, current.join(' · '))}</span>
        <span className={styles.groupAction}>{open ? g.done : g.change}</span>
      </summary>
      <div className={styles.groupBody}>{children}</div>
    </details>
  );
}
