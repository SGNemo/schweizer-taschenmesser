import type { ReactNode } from 'react';
import { SIGNATURE_MARKS } from './SignatureMark';
import styles from './blocks.module.css';

/**
 * The signature library (identity v3.1, F12): the decoration blocks a module's head and widget are recognised by,
 * at slot size `M` (up to 36 rem) and `L` (the whole column). Each block is drawn from the module hue and the
 * surface (`--module-color`, `--surface`), so it works without colour ("Ruhig" turns the hue grey) and in both
 * themes; it holds no user data of its own – `children`, where offered, is the one line a module may put on it
 * (a count, a title), as real text. All blocks are hidden from assistive tech: the words next to them carry the
 * meaning. The module copies (`modules/<id>/components/…Signature.tsx`) move onto these in the module packages.
 */
export type BlockSize = 'M' | 'L';

interface BlockProps {
  size?: BlockSize;
  children?: ReactNode;
}

const block = (id: string, size: BlockSize | undefined, extra?: string) => ({
  className: [styles.block, styles[id], extra].filter(Boolean).join(' '),
  'data-signature': id,
  'data-size': size,
  'aria-hidden': true as const,
});

/** A till receipt: a paper strip with a torn lower edge and a few ruled lines; `children` = the one line on it. */
export function Receipt({ size, children }: BlockProps) {
  return (
    <div {...block('receipt', size)}>
      <i className={styles.rule} />
      <i className={styles.rule} />
      <i className={`${styles.rule} ${styles.short}`} />
      {children ? <span className={styles.text}>{children}</span> : null}
    </div>
  );
}

/** An invoice: a sheet with a few lines and the sum line at the bottom; `children` = the sum. */
export function Bill({ size, children }: BlockProps) {
  return (
    <div {...block('bill', size)}>
      <i className={styles.rule} />
      <i className={`${styles.rule} ${styles.short}`} />
      <i className={styles.rule} />
      <span className={styles.sum}>{children}</span>
    </div>
  );
}

/** Three folder tabs on a line, the first one up front; `children` = the label on the front tab. */
export function FolderTabs({ size, children }: BlockProps) {
  return (
    <div {...block('folderTab', size)}>
      <i className={styles.tab} />
      <i className={styles.tab} />
      <i className={styles.tab}>
        {children ? <span className={styles.text}>{children}</span> : null}
      </i>
      <i className={styles.shelfLine} />
    </div>
  );
}

/** A postage stamp: perforated edge, a frame inside; `children` = the figure on it (a count). */
export function Stamp({ size, children }: BlockProps) {
  return (
    <div {...block('stamp', size)}>
      <span className={styles.frame}>{children}</span>
    </div>
  );
}

/** A pinboard with three pinned notes. */
export function Pinboard({ size }: BlockProps) {
  return (
    <div {...block('pinboard', size)}>
      <i className={styles.note} />
      <i className={styles.note} />
      <i className={styles.note} />
    </div>
  );
}

/** Ruled note paper with a folded corner; `children` = the first line, in serif. */
export function NotePaper({ size, children }: BlockProps) {
  return (
    <div {...block('notePaper', size)}>
      {children ? <span className={`${styles.text} ${styles.serif}`}>{children}</span> : null}
    </div>
  );
}

/** Two speech bubbles, one from each side. */
export function Bubble({ size, children }: BlockProps) {
  return (
    <div {...block('bubble', size)}>
      <i className={styles.bubbleA}>
        {children ? <span className={styles.text}>{children}</span> : null}
      </i>
      <i className={styles.bubbleB} />
    </div>
  );
}

/** A browser address bar with the lock; `children` = the host, in mono. */
export function AddressBar({ size, children }: BlockProps) {
  return (
    <div {...block('addressBar', size)}>
      <svg viewBox="0 0 24 24" className={styles.lock}>
        <rect x="6" y="11.2" width="12" height="9" rx="2" />
        <path d="M8.5 11V8.5a3.5 3.5 0 0 1 7 0V11" />
      </svg>
      {children ? <span className={`${styles.text} ${styles.mono}`}>{children}</span> : null}
    </div>
  );
}

/** Four things of different heights on a shelf line. */
export function Shelf({ size }: BlockProps) {
  return (
    <div {...block('shelf', size)}>
      <i className={styles.item} />
      <i className={styles.item} />
      <i className={styles.item} />
      <i className={styles.item} />
      <i className={styles.shelfLine} />
    </div>
  );
}

/** A ring in the hue around a person silhouette. */
export function AvatarRing({ size }: BlockProps) {
  return (
    <div {...block('avatarRing', size)}>
      <svg viewBox="0 0 24 24" className={styles.mark}>
        {SIGNATURE_MARKS.avatarRing}
      </svg>
    </div>
  );
}

/** Two gauges, needles at different angles. */
export function Gauges({ size }: BlockProps) {
  return (
    <div {...block('gauges', size)}>
      {[52, 118].map((angle) => (
        <svg key={angle} viewBox="0 0 48 30" className={styles.gauge}>
          <path d="M4 26a20 20 0 0 1 40 0" className={styles.track} />
          <path d="M4 26a20 20 0 0 1 20-20" />
          <line
            x1="24"
            y1="26"
            x2={24 + 15 * Math.cos((Math.PI * (180 + angle)) / 180)}
            y2={26 + 15 * Math.sin((Math.PI * (180 + angle)) / 180)}
            className={styles.needle}
          />
        </svg>
      ))}
    </div>
  );
}

/** An arrow band, filled to `value` (0..1). */
export function ArrowBand({ size, value = 0.6 }: BlockProps & { value?: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div {...block('arrowProgress', size)}>
      <i className={styles.fill} style={{ width: `${Math.round(v * 100)}%` }} />
    </div>
  );
}

/** A newspaper masthead: a thick rule, a title line and two columns; `children` = the title, in serif. */
export function Masthead({ size, children }: BlockProps) {
  return (
    <div {...block('masthead', size)}>
      <span className={`${styles.text} ${styles.serif} ${styles.mastTitle}`}>{children}</span>
      <i className={styles.thick} />
      <span className={styles.columns}>
        <i className={styles.rule} />
        <i className={styles.rule} />
        <i className={styles.rule} />
        <i className={styles.rule} />
        <i className={`${styles.rule} ${styles.short}`} />
        <i className={styles.rule} />
      </span>
    </div>
  );
}
