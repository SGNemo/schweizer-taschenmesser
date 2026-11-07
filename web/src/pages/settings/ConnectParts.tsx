import type { ReactNode } from 'react';
import type { IconName } from '@/ui';
import { StatusCard } from './components/StatusCard';
import styles from './ConnectParts.module.css';

/**
 * Building blocks of the "connect / set up" cards (Sync, Backup, later AI and connections): one banner that says
 * the state first, numbered or plain steps with a short hint, a grid of facts and one row of actions.
 */

/**
 * The state in words and an icon (never colour alone); `children` sit on the right (a badge). Since settings identity
 * v3.1 this is the shared `StatusCard` (tinted in the tab's hue); a second card on the same tab passes `tinted={false}`.
 */
export function StateBanner(props: {
  /** Leave out where the words say it all (keeps the page quiet). */
  icon?: IconName;
  title: string;
  line?: ReactNode;
  tone?: 'neutral' | 'ok' | 'attention';
  tinted?: boolean;
  testId?: string;
  /** Test id on the state words alone (a test that reads exactly the status). */
  titleTestId?: string;
  children?: ReactNode;
}) {
  return <StatusCard {...props} />;
}

/**
 * One group of a card: a heading with a short hint above its fields; groups are separated by a hairline. Settings
 * identity v3.1: groups carry a heading, not a step number – `n` is accepted for the callers' reading order only and
 * is not drawn.
 */
export function Step({
  title,
  hint,
  children,
}: {
  /** Order of the group in its card; not drawn since identity v3.1 (headings instead of numbered steps). */
  n?: number;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.step} aria-label={title}>
      <header className={styles.stepHead}>
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
