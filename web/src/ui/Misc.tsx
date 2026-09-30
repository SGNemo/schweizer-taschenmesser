import { useEffect, type ReactNode } from 'react';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Icon, type IconName } from './icons';
import { Logo } from './Logo';
import styles from './Misc.module.css';

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
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

export function EmptyState({
  icon,
  title,
  compact,
  children,
}: {
  /** Without an icon the empty state shows the (faded) Nemo fish. */
  icon?: IconName;
  title: string;
  /** One-line variant for dashboard widgets and other small containers. */
  compact?: boolean;
  children?: ReactNode;
}) {
  const mark = compact ? 22 : 28;
  return (
    <div className={compact ? `${styles.empty} ${styles.emptyCompact}` : styles.empty}>
      <span className={styles.emptyMark}>
        {icon ? <Icon name={icon} size={mark} /> : <Logo size={compact ? 22 : 36} />}
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
