import { useSupporter, useSupporterSettings } from '@/core/supporter';
import { t } from '@/strings';
import { Icon } from '@/ui';
import styles from './SupporterBadge.module.css';

/**
 * The "Danke" tag: tier plus the name, if one was given. Cosmetic – no link, no prompt. In the
 * sidebar head it appears only when the user switched it on (Einstellungen → Supporter).
 */
export function SupporterBadge({ placement }: { placement: 'about' | 'sidebar' }) {
  const status = useSupporter();
  const [settings] = useSupporterSettings();
  if (status.tier === 'none') return null;
  if (placement === 'sidebar' && !settings?.showSidebarBadge) return null;
  const s = t.supporter;
  const thanks = status.name ? s.badge.thanksName(status.name) : s.badge.thanks;
  const label = `${thanks} · ${s.tier[status.tier]}`;
  return (
    <span
      className={[styles.badge, placement === 'sidebar' ? styles.compact : ''].join(' ')}
      data-testid={`supporter-badge-${placement}`}
      data-tier={status.tier}
      title={label}
    >
      <Icon name="sparkles" size={14} />
      <span className={styles.text}>{placement === 'sidebar' ? s.tier[status.tier] : label}</span>
    </span>
  );
}
