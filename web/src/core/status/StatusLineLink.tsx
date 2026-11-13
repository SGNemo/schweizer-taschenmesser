import { Link } from 'react-router';
import { Icon } from '@/ui';
import type { StatusLine } from './lines';
import styles from './StatusLineLink.module.css';

/**
 * One state as one line of text and a link to where it is set: name, state, context; no frame, no fill. "Needs a
 * look" is said by the words of the state and a small ink mark before them, never by red and never by colour alone.
 * Used by the settings start page and by the page "Gerätestatus".
 */
export function StatusLineLink({
  line,
  hideGenericOnPhone = false,
  layout = 'inline',
}: {
  line: StatusLine;
  /** The settings head shows two columns of lines on the phone and drops a context that only explains (U55). */
  hideGenericOnPhone?: boolean;
  /**
   * `inline` (settings head): name, state and context flow in one line and wrap where the column ends.
   * `columns` (a list of lines under each other): names, states and contexts stand in three columns, so a list reads
   * like a table; on the phone the context takes the second line of every row.
   */
  layout?: 'inline' | 'columns';
}) {
  return (
    <Link
      to={line.to}
      className={styles.line}
      data-testid={line.testId}
      data-attention={line.attention}
      data-layout={layout}
      data-generic={(hideGenericOnPhone && line.generic) || undefined}
    >
      <span className={styles.name}>
        <Icon name={line.icon} />
        {line.title}
      </span>
      <span className={styles.status}>{line.status}</span>
      <span className={styles.context}>{line.context}</span>
    </Link>
  );
}
