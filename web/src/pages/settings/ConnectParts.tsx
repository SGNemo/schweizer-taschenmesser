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
  titleTestId,
  children,
}: {
  /** Leave out where the words say it all (keeps the page quiet). */
  icon?: IconName;
  title: string;
  line?: ReactNode;
  tone?: 'neutral' | 'ok' | 'attention';
  testId?: string;
  /** Test id on the state words alone (a test that reads exactly the status). */
  titleTestId?: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.banner} data-tone={tone} data-testid={testId}>
      {icon ? (
        <span className={styles.bannerIcon} aria-hidden="true">
          <Icon name={icon} size={22} />
        </span>
      ) : null}
      <div className={styles.bannerText}>
        <p className={styles.bannerTitle} data-testid={titleTestId}>
          {title}
        </p>
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

/**
 * A framed list of choices (checkboxes with a title and a detail line): one hairline between rows, the whole
 * row is the target. The legend names the group for assistive tech and sits above the frame.
 */
export function ChoiceList({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className={styles.choices}>
      <legend className={styles.choicesLegend}>{legend}</legend>
      <div className={styles.choicesFrame}>{children}</div>
    </fieldset>
  );
}
