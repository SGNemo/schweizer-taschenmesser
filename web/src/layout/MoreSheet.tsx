import { Link, useLocation } from 'react-router';
import type { NavArea } from '@/core/modules/areas';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Dialog, Icon } from '@/ui';
import styles from './SheetList.module.css';

/** "Mehr": areas that did not fit the bottom bar, then tools, library and settings. */
export function MoreSheet({
  open,
  onClose,
  areas,
}: {
  open: boolean;
  onClose: () => void;
  areas: NavArea[];
}) {
  const openTools = useUiStore((s) => s.openTools);
  const { pathname } = useLocation();
  // The place the bar's "Mehr" stands for is marked here too (M8 follow-up of 0b-8).
  const here = (to: string, items: { to: string }[] = [{ to }]) =>
    items.some((i) => pathname === i.to || pathname.startsWith(`${i.to}/`)) ? 'page' : undefined;
  return (
    <Dialog open={open} onClose={onClose} title={t.nav.more}>
      <ul className={styles.list}>
        {areas.map((a) => (
          <li key={a.id}>
            <Link
              to={a.to}
              className={styles.link}
              onClick={onClose}
              aria-current={here(a.to, a.items)}
            >
              <Icon name={a.icon} />
              {a.label}
            </Link>
          </li>
        ))}
        <li>
          <button
            type="button"
            className={styles.link}
            onClick={() => {
              onClose();
              openTools();
            }}
          >
            <Icon name="wrench" />
            {t.nav.tools}
          </button>
        </li>
        <li>
          <Link
            to="/library"
            className={styles.link}
            onClick={onClose}
            aria-current={here('/library')}
          >
            <Icon name="grid" />
            {t.nav.library}
          </Link>
        </li>
        <li>
          <Link
            to="/settings"
            className={styles.link}
            onClick={onClose}
            aria-current={here('/settings')}
          >
            <Icon name="settings" />
            {t.nav.settings}
          </Link>
        </li>
      </ul>
    </Dialog>
  );
}
