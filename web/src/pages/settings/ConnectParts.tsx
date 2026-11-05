import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/ui';
import styles from './ConnectParts.module.css';

/**
 * Building blocks of the "connect / set up" cards (Sync, Backup, later AI and connections): one banner that says
 * the state first, numbered or plain steps with a short hint, a grid of facts and one row of actions.
 */

/** The state in words and an icon (never colour alone); `children` sit on the right (a badge). */
export function StateBanner({
  icon,
  title,
  line,
  tone = 'neutral',
  testId,
  children,
}: {
  icon: IconName;
  title: string;
  line?: ReactNode;
  tone?: 'neutral' | 'ok' | 'attention';
  testId?: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.banner} data-tone={tone} data-testid={testId}>
      <span className={styles.bannerIcon} aria-hidden="true">
        <Icon name={icon} size={22} />
      </span>
      <div className={styles.bannerText}>
        <p className={styles.bannerTitle}>{title}</p>
        {line ? <p className={styles.bannerLine}>{line}</p> : null}
      </div>
      {children ? <div className={styles.bannerAside}>{children}</div> : null}
    </div>
  );
}

/** One step of a card: a title with a short hint above its fields; steps are separated by a hairline. */
export function Step({
  n,
  title,
  hint,
  children,
}: {
  /** Shown in a small round mark; leave out for a step that is not part of a sequence. */
  n?: number;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.step} aria-label={title}>
      <header className={styles.stepHead}>
        {n ? (
          <span className={styles.stepNo} aria-hidden="true">
            {n}
          </span>
        ) : null}
        <div>
          <h3 className={styles.stepTitle}>{title}</h3>
          {hint ? <p className={styles.stepHint}>{hint}</p> : null}
        </div>
      </header>
      <div className={styles.stepBody}>{children}</div>
    </section>
  );
}

export interface Fact {
  label: string;
  value: ReactNode;
  testId?: string;
}

/** Label / value tiles instead of a table: the state at a glance. */
export function Facts({ label, items }: { label: string; items: readonly Fact[] }) {
  return (
    <dl className={styles.facts} aria-label={label} data-testid="connect-facts">
      {items.map((f) => (
        <div key={f.label} className={styles.fact}>
          <dt>{f.label}</dt>
          <dd data-testid={f.testId}>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The actions of a step: the main one first, the rest quiet. */
export function Actions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}
