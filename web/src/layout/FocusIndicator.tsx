import { Link } from 'react-router';
import { clock, isOver, timeLeft } from '@/core/focus/session';
import { useFocusSession } from '@/core/focus/state';
import { useNow } from '@/core/focus/useNow';
import { useFocusSettings } from '@/core/settings/focus';
import { t } from '@/strings';
import { Icon } from '@/ui';
import styles from './TopBar.module.css';

/** Small link in the top bar while a focus round runs: time left, back to the focus screen. */
export function FocusIndicator() {
  const session = useFocusSession();
  const [settings] = useFocusSettings();
  const tick = useNow(1000, Boolean(session) && settings.focusIndicator);
  if (!session || !settings.focusIndicator || !session.path) return null;
  const over = isOver(session, tick);
  const label = over ? t.focus.mode.indicatorOver : clock(timeLeft(session, tick));
  return (
    <Link
      to={session.path}
      className={styles.focusChip}
      aria-label={t.focus.mode.indicatorAria(session.title, label)}
      data-testid="focus-indicator"
    >
      <Icon name="clock" size={18} />
      <span className={styles.focusTime}>{label}</span>
    </Link>
  );
}
