import { useEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button } from './Button';
import { Icon } from './icons';
import { Logo } from './Logo';
import styles from './Misc.module.css';

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
}) {
  return (
    <span className={[styles.badge, tone === 'neutral' ? '' : styles[tone]].join(' ')}>
      {children}
    </span>
  );
}

/** Loading placeholder with a soft shimmer (use instead of a spinner). Size it with CSS/props. */
export function Skeleton({
  width = '100%',
  height = '1rem',
  radius,
}: {
  width?: string | number;
  height?: string | number;
  radius?: string;
}) {
  return (
    <span
      className={styles.skeleton}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

/** Three skeleton bars for a list that is still loading. */
export function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className={styles.skeletonRows} role="status" aria-label={t.ui.loading}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} height="2.5rem" radius="var(--radius-md)" />
      ))}
    </div>
  );
}

/**
 * The faded Nemo fish, one sentence and (as `children`) at most one button. A module with its own picture passes it as
 * `motif` (a 96 × 64 outline drawing, decoration only: it should be `aria-hidden`); the compact variant keeps the fish.
 */
export function EmptyState({
  title,
  compact,
  motif,
  testId,
  children,
}: {
  title: string;
  /** One-line variant for dashboard widgets and other small containers. */
  compact?: boolean;
  /** The module's own picture instead of the fish (not used by the compact variant). */
  motif?: ReactNode;
  testId?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={compact ? `${styles.empty} ${styles.emptyCompact}` : styles.empty}
      data-testid={testId}
    >
      {motif && !compact ? (
        <span className={styles.emptyMotif}>{motif}</span>
      ) : (
        <span className={styles.emptyMark}>
          <Logo mono size={compact ? 28 : 60} />
        </span>
      )}
      {compact ? (
        <p className={styles.emptyTitle}>{title}</p>
      ) : (
        <h2 className={styles.emptyTitle}>{title}</h2>
      )}
      {children}
    </div>
  );
}

/** Inline error: icon, one sentence, optional retry. Sync errors belong in the shell banner. */
export function ErrorState({ title, onRetry }: { title: string; onRetry?: () => void }) {
  return (
    <div className={styles.error} role="alert">
      <Icon name="cloudOff" size={20} />
      <p className={styles.errorText}>{title}</p>
      {onRetry ? (
        <Button size="sm" onClick={onRetry}>
          {t.ui.retry}
        </Button>
      ) : null}
    </div>
  );
}

export function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className={styles.fab} aria-label={label} title={label} onClick={onClick}>
      <Icon name="plus" size={26} />
    </button>
  );
}

const TOAST_MS = 6000;

export function Toaster() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);
  // "Hinweise bleiben stehen" (focus aid): no clock at all; "Schließen" is then always there.
  const stay = useUiStore((s) => s.toastStay);
  // While the pointer or the keyboard focus is in a toast, no toast hides itself (A04, round 5).
  // The hold belongs to one toast: a toast that is replaced while held cannot report leaving, and
  // its id simply is no longer shown, so the next toast runs its clock again.
  const [pointer, setPointer] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const held = stay || toasts.some((x) => x.id === pointer || x.id === focus);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  // One timer per toast: a new toast never restarts the countdown of an older one. Holding clears
  // the clocks; letting go gives every toast the full time again.
  useEffect(() => {
    const running = timers.current;
    if (held) {
      running.forEach(clearTimeout);
      running.clear();
      return;
    }
    for (const x of toasts) {
      if (!running.has(x.id))
        running.set(
          x.id,
          setTimeout(() => dismiss(x.id), TOAST_MS),
        );
    }
    for (const [id, handle] of running) {
      if (!toasts.some((x) => x.id === id)) {
        clearTimeout(handle);
        running.delete(id);
      }
    }
  }, [toasts, dismiss, held]);
  useEffect(() => {
    const running = timers.current;
    return () => {
      running.forEach(clearTimeout);
      running.clear();
    };
  }, []);
  // A closed toast cannot report leaving any more: closing by hand lets go of the hold.
  const close = (id: number) => {
    setPointer(null);
    setFocus(null);
    dismiss(id);
  };

  return (
    <div className={styles.toasts} role="status" aria-live="polite">
      {toasts.map((x) => (
        <div
          key={x.id}
          className={styles.toast}
          onPointerEnter={() => setPointer(x.id)}
          onPointerLeave={() => setPointer(null)}
          onFocus={() => setFocus(x.id)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus(null);
          }}
        >
          {x.icon ? <Icon name={x.icon} size={18} /> : null}
          <span className={styles.toastText}>{x.message}</span>
          {x.lead ? (
            <button
              type="button"
              className={styles.toastAction}
              onClick={() => {
                x.lead?.run();
                close(x.id);
              }}
            >
              {x.lead.label}
            </button>
          ) : null}
          {x.action ? (
            <button
              type="button"
              className={styles.toastAction}
              onClick={() => {
                x.action?.run();
                close(x.id);
              }}
            >
              {x.action.label}
            </button>
          ) : null}
          {/* Without an action always; with one when toasts stay, so a staying toast can always be closed. */}
          {!x.action || stay ? (
            <button type="button" className={styles.toastAction} onClick={() => close(x.id)}>
              {t.actions.close}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
