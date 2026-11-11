import type { ReactNode } from 'react';
import { tFields } from '@/strings.fields';
import { IconButton } from './Button';
import { Icon } from './icons';
import styles from './DetailPanel.module.css';

/**
 * The detail of the row picked in a master–detail page (`manifest.layout: 'split'`, Identity 4.0 rule 5): it lies
 * in the panel of `SplitView` on one raised tone, without frame or shadow. Eyebrow, the entry's title, one figure,
 * a short list of facts and at most three actions; everything else is in the entry's dialog ("Bearbeiten").
 * Below the split width a page opens that dialog (a bottom sheet on the phone) instead of this panel.
 */
export function DetailPanel({
  eyebrow,
  title,
  figure,
  facts = [],
  children,
  actions,
  onClose,
  testId,
}: {
  eyebrow?: string;
  title: string;
  /** The entry's one number (an amount), already formatted. */
  figure?: ReactNode;
  facts?: readonly { label: string; value: ReactNode }[];
  children?: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
  testId?: string;
}) {
  const tx = tFields.use();
  return (
    <div className={styles.panel} data-testid={testId} data-detail-panel="">
      <div className={styles.head}>
        <div className={styles.headText}>
          {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
          <h2 className={styles.title}>{title}</h2>
        </div>
        <IconButton label={tx.closeDetail} onClick={onClose}>
          <Icon name="close" />
        </IconButton>
      </div>
      {figure ? <p className={styles.figure}>{figure}</p> : null}
      {facts.length > 0 ? (
        <dl className={styles.facts}>
          {facts.map((f) => (
            <div key={f.label} className={styles.fact}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {children}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}
