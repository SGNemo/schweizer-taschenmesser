import type { ReactNode } from 'react';
import { Card } from './Card';
import { Icon, type IconName } from './icons';
import { ReadableText } from './ReadableText';
import styles from './LibraryCard.module.css';

/**
 * One entry of a library (modules, tools): icon, name, badges, a one-line description and the
 * actions on the right. The module and the tool library share it, so both look and behave alike.
 * `id` is the deep-link anchor (`/library#module-<id>`, `/tools#tool-<id>`).
 */
export function LibraryCard({
  id,
  testId,
  icon,
  name,
  badges,
  description,
  children,
}: {
  id: string;
  testId: string;
  icon: IconName;
  name: string;
  badges?: ReactNode;
  description: string;
  /** The actions (switch, buttons); rendered on the right below the description. */
  children?: ReactNode;
}) {
  return (
    <Card as="li" id={id} className={styles.card} data-testid={testId}>
      <div className={styles.head}>
        <span className={styles.icon}>
          <Icon name={icon} />
        </span>
        <span className={styles.name}>{name}</span>
        {badges}
      </div>
      <p className={styles.desc}>
        <ReadableText text={description} />
      </p>
      {children ? <div className={styles.actions}>{children}</div> : null}
    </Card>
  );
}
