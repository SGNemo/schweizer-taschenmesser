import { useCenterStore } from '@/core/notifications/centerStore';
import { useOpenReminders } from '@/core/notifications/useOpenReminders';
import { t } from '@/strings';
import { Icon } from '@/ui';
import styles from './NotificationBell.module.css';

/** Bell in the top bar with a quiet count of open reminders; opens the notification centre. */
export function NotificationBell() {
  const open = useOpenReminders();
  const openCenter = useCenterStore((s) => s.openCenter);
  const n = open.length;
  return (
    <>
      <button
        type="button"
        className={styles.bell}
        aria-label={t.reminder.center.bell(n)}
        title={t.reminder.center.title}
        aria-haspopup="dialog"
        onClick={() => openCenter('list')}
        data-testid="notification-bell"
      >
        <Icon name="bell" />
        {n > 0 ? (
          <span className={styles.count} aria-hidden="true" data-testid="notification-count">
            {n > 99 ? '99+' : n}
          </span>
        ) : null}
      </button>
      {/* Screen readers hear the count change without a focus move or a sound. */}
      <span className="sr-only" role="status" aria-live="polite">
        {n > 0 ? t.reminder.center.count(n) : ''}
      </span>
    </>
  );
}
