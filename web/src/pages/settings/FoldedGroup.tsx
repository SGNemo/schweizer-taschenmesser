import { useState, type ReactNode } from 'react';
import { t } from '@/strings';
import styles from './settings.module.css';

/**
 * One group of settings shown as a single line with the current choice ("Thema: Hell · Ändern");
 * the pickers appear only once it is opened. A deep link opens the surrounding `<details>` itself
 * (SettingsLayout), so `onToggle` keeps the label and `aria-expanded` in step with the real state.
 * `section` names the settings section for the test id (`<section>-group-<id>`).
 */
export function FoldedGroup({
  id,
  section = 'appearance',
  testId,
  title,
  current,
  onToggle,
  children,
}: {
  id: string;
  section?: string;
  /** Overrides the derived test id (kept for blocks that specs already know by name). */
  testId?: string;
  title: string;
  /** The values chosen right now, in the order of the pickers. */
  current: string[];
  /** Called with the new state whenever the group opens or closes (lazy loading of a picker). */
  onToggle?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const g = t.settings.appearanceGroups;
  const value = current.join(' · ');
  return (
    <details
      className={styles.group}
      data-testid={testId ?? `${section}-group-${id}`}
      onToggle={(e) => {
        setOpen(e.currentTarget.open);
        onToggle?.(e.currentTarget.open);
      }}
    >
      <summary className={styles.groupSummary} aria-expanded={open}>
        <span className={styles.groupLine}>{value === '' ? title : g.line(title, value)}</span>
        <span className={styles.groupAction}>{open ? g.done : g.change}</span>
      </summary>
      <div className={styles.groupBody}>{children}</div>
    </details>
  );
}
