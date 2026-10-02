import { useEffect, type ReactNode } from 'react';
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

/** The faded Nemo fish, one sentence and (as `children`) at most one button. */
export function EmptyState({
  title,
  compact,
  children,
}: {
  title: string;
  /** One-line variant for dashboard widgets and other small containers. */
  compact?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={compact ? `${styles.empty} ${styles.emptyCompact}` : styles.empty}>
      <span className={styles.emptyMark}>
        <Logo mono size={compact ? 28 : 60} />
      </span>
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

const TOAST_MS = 5000;

export function Toaster() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);

  useEffect(() => {
    const timers = toasts.map((x) => setTimeout(() => dismiss(x.id), TOAST_MS));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  return (
    <div className={styles.toasts} role="status" aria-live="polite">
      {toasts.map((x) => (
        <div key={x.id} className={styles.toast}>
          <span>{x.message}</span>
          {x.action ? (
            <button
              type="button"
              className={styles.toastAction}
              onClick={() => {
                x.action?.run();
                dismiss(x.id);
              }}
            >
              {x.action.label}
            </button>
          ) : (
            <button type="button" className={styles.toastAction} onClick={() => dismiss(x.id)}>
              {t.actions.close}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
