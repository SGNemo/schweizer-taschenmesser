import type { ReactNode } from 'react';
import type { ModuleHue } from '@/core/modules/types';
import { Card } from './Card';
import { HuePlate } from './HuePlate';
import { Icon, type IconName } from './icons';
import { ReadableText } from './ReadableText';
import styles from './LibraryCard.module.css';

/**
 * One entry of a library (modules, tools): icon, name, badges, a one-line description and the
 * actions on the right. The module and the tool library share it, so both look and behave alike.
 * `id` is the deep-link anchor (`/library#module-<id>`, `/tools#tool-<id>`). With a `hue` the head is tinted in it
 * (identity v3) with the solid `HuePlate` (the same plate as in settings and the module head) and `preview` shows a drawn sketch under the head; without them the card looks as before.
 */
export function LibraryCard({
  id,
  testId,
  icon,
  name,
  badges,
  description,
  hue,
  plainHead,
  preview,
  children,
}: {
  id: string;
  testId: string;
  icon: IconName;
  name: string;
  badges?: ReactNode;
  description: string;
  /** Identity colour of the module or tool: tints the head and the plate (grey in "Ruhig"). */
  hue?: ModuleHue;
  /** No tint behind the head: the plate alone carries the hue (module library, Identity 4.0: two levels at most). */
  plainHead?: boolean;
  /** A drawn sketch between the head and the description (`aria-hidden` by itself). */
  preview?: ReactNode;
  /** The actions (switch, buttons); rendered on the right below the description. */
  children?: ReactNode;
}) {
  return (
    <Card as="li" id={id} className={styles.card} data-testid={testId} data-hue={hue}>
      <div className={styles.head} data-tinted={hue && !plainHead ? 'true' : undefined}>
        {hue ? (
          <HuePlate hue={hue} icon={icon} size="lg" />
        ) : (
          <span className={styles.icon}>
            <Icon name={icon} />
          </span>
        )}
        <span className={styles.name} data-card-name>
          {name}
        </span>
        {badges}
      </div>
      {preview}
      <p className={styles.desc}>
        <ReadableText text={description} />
      </p>
      {children ? <div className={styles.actions}>{children}</div> : null}
    </Card>
  );
}
