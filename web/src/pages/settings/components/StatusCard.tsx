import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/ui';
import styles from './StatusCard.module.css';

/**
 * The one state card of a settings tab (settings identity v3.1): the state in words first, an optional figure or icon
 * on the left, one action on the right. A raised tone since Identity 4.0 (no frame, no tint; `tinted` is kept as a
 * hook for the tab's first card). Colour never carries the state alone.
 */
export function StatusCard({
  icon,
  figure,
  title,
  line,
  tone = 'neutral',
  tinted = true,
  action,
  body,
  testId,
  titleTestId,
  children,
}: {
  /** Leave out where the words say it all (keeps the page quiet). */
  icon?: IconName;
  /** A small figure instead of the icon (a progress ring); decoration, the title says the same in words. */
  figure?: ReactNode;
  title: string;
  line?: ReactNode;
  tone?: 'neutral' | 'ok' | 'attention';
  tinted?: boolean;
  /** The tab's primary action, at the right (below on narrow screens). */
  action?: ReactNode;
  /** Content across the whole card under the words (a live sample); the card stays one block. */
  body?: ReactNode;
  testId?: string;
  /** Test id on the state words alone (a test that reads exactly the status). */
  titleTestId?: string;
  /** Extra content at the right (a badge). */
  children?: ReactNode;
}) {
  return (
    <div
      className={styles.card}
      data-tone={tone}
      data-tinted={tinted ? 'true' : 'false'}
      data-testid={testId}
      data-status-card=""
    >
      {figure ? (
        <span className={styles.figure} aria-hidden="true">
          {figure}
        </span>
      ) : icon ? (
        <span className={styles.icon} aria-hidden="true">
          <Icon name={icon} size={22} />
        </span>
      ) : null}
      <div className={styles.text}>
        <p className={styles.title} data-testid={titleTestId}>
          {title}
        </p>
        {line ? <p className={styles.line}>{line}</p> : null}
      </div>
      {children ? <div className={styles.aside}>{children}</div> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
      {body ? <div className={styles.body}>{body}</div> : null}
    </div>
  );
}
