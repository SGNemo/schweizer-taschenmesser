import { NavLink } from 'react-router';
import { t } from '@/strings';
import { Dialog, Icon } from '@/ui';
import type { NavItem } from './useNavItems';
import styles from './AppShell.module.css';

export function MoreSheet({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
}) {
  return (
    <Dialog open={open} onClose={onClose} title={t.nav.more} variant="sheet">
      <ul className={styles.navList}>
        {items.map((i) => (
          <li key={i.to}>
            <NavLink to={i.to} className={styles.navLink} onClick={onClose}>
              <Icon name={i.icon} />
              {i.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
