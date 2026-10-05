import { Link, useLocation } from 'react-router';
import { areaOfPath, type NavTree } from '@/core/modules/areas';
import { t } from '@/strings';
import { Icon } from '@/ui';
import styles from './BottomNav.module.css';

/** Areas shown in the bottom bar; the rest lives in the "Mehr" sheet. */
export const BOTTOM_AREA_SLOTS = 3;

export function BottomNav({ tree, onMore }: { tree: NavTree; onMore: () => void }) {
  const { pathname } = useLocation();
  const activeArea = areaOfPath(tree, pathname)?.id;
  const items = [
    {
      key: 'home',
      to: '/',
      label: t.nav.home,
      icon: 'home' as const,
      active: pathname === '/',
      area: undefined,
    },
    ...tree.areas.slice(0, BOTTOM_AREA_SLOTS).map((a) => ({
      key: a.id,
      to: a.to,
      label: a.label,
      icon: a.icon,
      active: activeArea === a.id,
      area: a.id,
    })),
  ];
  return (
    <nav aria-label={t.nav.main} className={styles.bottom}>
      {items.map((i) => (
        <Link
          key={i.key}
          to={i.to}
          className={styles.link}
          data-area={i.area}
          aria-current={i.active ? 'page' : undefined}
        >
          <Icon name={i.icon} />
          {i.label}
        </Link>
      ))}
      <button type="button" className={styles.link} onClick={onMore}>
        <Icon name="more" />
        {t.nav.more}
      </button>
    </nav>
  );
}
