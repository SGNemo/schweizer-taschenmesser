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

/** Two gauges, track only, needles at rest: a shape, never a reading. */
export function Gauges({ size }: BlockProps) {
  return (
    <div {...block('gauges', size)}>
      {['a', 'b'].map((key) => (
        <svg key={key} viewBox="0 0 48 30" className={styles.gauge}>
          <path d="M4 26a20 20 0 0 1 40 0" className={styles.track} />
          <line x1="24" y1="26" x2="9" y2="26" className={styles.needle} />
        </svg>
      ))}
    </div>
  );
}

/** An arrow band; the track alone by default (no invented progress), filled to `value` (0..1) when a page says so. */
export function ArrowBand({ size, value = 0 }: BlockProps & { value?: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div {...block('arrowProgress', size)}>
      <i className={styles.fill} style={{ width: `${Math.round(v * 100)}%` }} />
    </div>
  );
}

/** The seven bars of the planner's week; `fill` (0..1 per day, Monday first) is the real load when a page knows it, else a still pattern. */
export const WEEK_BARS_DEFAULT: readonly number[] = [0.7, 0.4, 0.9, 0.55, 0.15, 0.3, 0];
export function WeekBars({
  size,
  fill = WEEK_BARS_DEFAULT,
}: BlockProps & { fill?: readonly number[] }) {
  return (
    <div {...block('weekBars', size)}>
      {Array.from({ length: 7 }, (_, i) => {
        const v = Math.max(0, Math.min(1, fill[i] ?? 0));
        return (
          <span key={i} className={styles.weekBar}>
            <i style={{ height: `${Math.round(v * 100)}%` }} />
          </span>
        );
      })}
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

/**
 * An envelope card (Budgets): the flap in the top corner and a fill level that rises from the bottom. `fill` (0..1) is
 * the spent share when a page knows it, else a still half; `over` tints the level with the danger colour (the page says
 * "über" in words). `children` = the one line on it (the category name).
 */
export function Envelope({
  size,
  fill = 0.5,
  over,
  children,
}: BlockProps & { fill?: number; over?: boolean }) {
  const v = Math.max(0, Math.min(1, fill));
  return (
    <div {...block('envelope', size)} data-over={over ? 'true' : undefined}>
      <i className={styles.envLevel} style={{ height: `${Math.round(v * 100)}%` }} />
      <i className={styles.envFlap} />
      {children ? <span className={styles.text}>{children}</span> : null}
    </div>
  );
}
