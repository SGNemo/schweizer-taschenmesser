import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ackNotification } from '@/core/notifications/ack';
import { useReminderPrompts, type InAppPrompt } from '@/core/notifications/inapp';
import { snoozeNotification, snoozeOptions, type SnoozeOption } from '@/core/notifications/snooze';
import { getPlatform } from '@/core/platform';
import { useFocusSettings } from '@/core/settings/focus';
import { now } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button } from '@/ui';
import styles from './ReminderPrompt.module.css';

/** The base key of an extra notification (`…:s60`, `…:f`), so "Erledigt" also stops the follow-up. */
const baseKey = (key: string): string => key.replace(/:(s\d+|f)$/, '');

/**
 * A reminder that fires while the app is open appears here instead of as an OS popup: one card at a
 * time, "Erledigt" or "Später" with sensible options. Calm: no sound, no motion, no countdown.
 */
export function ReminderPrompt() {
  const items = useReminderPrompts((s) => s.items);
  const dismiss = useReminderPrompts((s) => s.dismiss);
  const toast = useUiStore((s) => s.toast);
  const [choosing, setChoosing] = useState(false);
  const [settings] = useFocusSettings();
  const current: InAppPrompt | undefined = items[0];
  const currentKey = current?.key;
  const seconds = settings.inAppSeconds;
  // The card hides itself after the chosen time; the reminder stays open in the notification centre.
  useEffect(() => {
    if (!currentKey || seconds === 0 || choosing) return;
    const id = window.setTimeout(() => dismiss(currentKey), seconds * 1000);
    return () => window.clearTimeout(id);
  }, [currentKey, seconds, choosing, dismiss]);
  if (!current) return null;

  const options = snoozeOptions(now(), getPlatform().kind);
  const done = async () => {
    await ackNotification(baseKey(current.key));
    setChoosing(false);
    dismiss(current.key);
  };
  const later = async (option: SnoozeOption) => {
    await snoozeNotification(current, option);
    setChoosing(false);
    dismiss(current.key);
    toast(t.reminder.snoozed[option]);
  };

  return (
    <section
      className={`${styles.card} ${settings.inAppPosition === 'bottom' ? styles.bottom : ''}`}
      aria-label={t.reminder.label}
      data-testid="reminder-prompt"
    >
      <span className={styles.label}>{t.reminder.label}</span>
      <span className={styles.title}>{current.title}</span>
      {current.body ? <span className={styles.body}>{current.body}</span> : null}
      {choosing ? (
        <ul className={styles.options} aria-label={t.reminder.later}>
          {options.map((o) => (
            <li key={o}>
              <button type="button" className={styles.option} onClick={() => void later(o)}>
                {t.reminder.laterOptions[o]}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.actions}>
          <Button variant="primary" data-autofocus onClick={() => void done()}>
            {t.reminder.done}
          </Button>
          <Button onClick={() => setChoosing(true)}>{t.reminder.later}</Button>
          {current.url ? (
            <Link to={current.url} onClick={() => void done()}>
              {t.reminder.open}
            </Link>
          ) : null}
        </div>
      )}
      {items.length > 1 ? (
        <span className={styles.more}>{t.reminder.more(items.length - 1)}</span>
      ) : null}
    </section>
  );
}
