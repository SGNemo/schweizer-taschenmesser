import { Icon, type IconName } from '../icons';
import type { DueTone } from '@/core/time/due';
import styles from './Widgets.module.css';

/** Tone → icon. Red is reserved for overdue/exceeded; every state carries an icon or text. */
const ICON: Partial<Record<DueTone, IconName>> = { overdue: 'alert', today: 'clock' };

/** Due-date state label: colour plus icon plus text (never colour alone). */
export function StateBadge({ tone, label }: { tone: DueTone; label: string }) {
  const icon = ICON[tone];
  return (
    <span className={[styles.state, styles[`state_${tone}`] ?? ''].join(' ')} data-tone={tone}>
      {icon ? <Icon name={icon} size={14} /> : null}
      {label}
    </span>
  );
}
