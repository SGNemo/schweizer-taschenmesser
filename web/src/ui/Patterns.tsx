/** Small layout building blocks shared by the module pages (headers, filters, lists, forms). */
import type { ReactNode } from 'react';
import { Card } from './Card';
import { useMediaQuery } from './useMediaQuery';
import styles from './Patterns.module.css';

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.header}>
      <h1>{title}</h1>
      {children}
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className={styles.toolbar}>{children}</div>;
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className={styles.segment} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue} data-testid={testId}>
        {value}
      </span>
    </div>
  );
}

/** Two or three form fields side by side. */
export function Split({ children }: { children: ReactNode }) {
  return <div className={styles.split}>{children}</div>;
}

export function Form({ children, onSubmit }: { children: ReactNode; onSubmit: () => void }) {
  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}

/** Footer of an editor form: `start` (e.g. delete) on the left, `children` (cancel/save) on the right. */
export function FormActions({ start, children }: { start?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.actions}>
      {start ?? <span />}
      <span className={styles.actionsEnd}>{children}</span>
    </div>
  );
}

/** `layout="grid"` turns the list into an auto-fill card grid once the page is wide enough. */
export function ItemList({
  children,
  label,
  layout = 'list',
}: {
  children: ReactNode;
  label?: string;
  layout?: 'list' | 'grid';
}) {
  return (
    <ul
      className={layout === 'grid' ? `${styles.list} ${styles.grid}` : styles.list}
      aria-label={label}
    >
      {children}
    </ul>
  );
}

/** A card row: a main button (title + meta lines, opens the editor) and optional trailing content. */
export function ItemRow({
  title,
  meta,
  onOpen,
  lead,
  end,
  children,
}: {
  title: ReactNode;
  meta?: ReactNode;
  onOpen?: () => void;
  lead?: ReactNode;
  end?: ReactNode;
  children?: ReactNode;
}) {
  const body = (
    <>
      <span className={styles.title}>{title}</span>
      {meta ? <span className={styles.muted}>{meta}</span> : null}
    </>
  );
  return (
    <Card as="li">
      <div className={styles.row}>
        {lead}
        {onOpen ? (
          <button type="button" className={styles.main} onClick={onOpen}>
            {body}
          </button>
        ) : (
          <div className={styles.main} style={{ cursor: 'default' }}>
            {body}
          </div>
        )}
        {end}
      </div>
      {children}
    </Card>
  );
}

/** Viewport width from which a page can afford a side panel next to its main content. */
export const SPLIT_QUERY = '(min-width: 1500px)';

/** True while the viewport is wide enough for a `SplitView` panel (see `SPLIT_QUERY`). */
export function useSplitView(query: string = SPLIT_QUERY): boolean {
  return useMediaQuery(query);
}

/**
 * Main content plus a side panel. With `enabled` false only the main content renders, so the
 * panel is a structural decision (never merely hidden, never a duplicate in the DOM).
 */
export function SplitView({
  children,
  aside,
  asideLabel,
  enabled,
}: {
  children: ReactNode;
  aside: ReactNode;
  asideLabel: string;
  enabled: boolean;
}) {
  if (!enabled) return <>{children}</>;
  return (
    <div className={styles.splitView}>
      <div className={styles.splitMain}>{children}</div>
      <aside className={styles.splitAside} aria-label={asideLabel}>
        {/* Absolutely positioned so the panel never makes the row taller than the main content. */}
        <div className={styles.splitAsideInner}>{aside}</div>
      </aside>
    </div>
  );
}

export function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  return onClick ? (
    <button type="button" className={styles.chip} aria-pressed={selected} onClick={onClick}>
      {label}
    </button>
  ) : (
    <span className={styles.chip}>{label}</span>
  );
}

export function Chips({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className={styles.chips} role={label ? 'group' : undefined} aria-label={label}>
      {children}
    </div>
  );
}

export function Progress({
  value,
  max,
  label,
  over,
}: {
  value: number;
  max: number;
  label: string;
  over?: boolean;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      className={styles.progress}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <div
        className={[styles.progressBar, over ? styles.progressOver : ''].join(' ')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export const patternStyles = styles;
