import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '../Button';
import { Icon, type IconName } from '../icons';
import { useWidgetSize } from './size';
import styles from './Widgets.module.css';

/**
 * Status card: a state with icon and one action (vault locked → "Entsperren", sync, updates). It
 * only ever shows the state, never content. Size l adds a hint line.
 */
export function StatusWidget({
  icon,
  state,
  hint,
  action,
  tone = 'neutral',
}: {
  icon: IconName;
  state: ReactNode;
  hint?: string;
  action?: { label: string; to?: string; onClick?: () => void };
  tone?: 'neutral' | 'warning' | 'success';
}) {
  const size = useWidgetSize();
  return (
    <div className={styles.status} data-tone={tone}>
      <p className={styles.statusState}>
        <Icon name={icon} size={20} />
        {state}
      </p>
      {size === 'l' && hint ? <p className={styles.sub}>{hint}</p> : null}
      {action?.to ? <Link to={action.to}>{action.label}</Link> : null}
      {action?.onClick ? (
        <Button variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
