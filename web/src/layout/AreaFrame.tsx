import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { areaOfPath } from '@/core/modules/areas';
import { t } from '@/strings';
import { useNavTree } from './useNavItems';
import styles from './AreaFrame.module.css';

/**
 * Frame of a module page that belongs to an area: the area name as eyebrow and, when the area has
 * more than one enabled module, its modules as tabs. Pure navigation; the module renders below.
 */
export function AreaFrame({ children }: { children: ReactNode }) {
  const tree = useNavTree();
  const { pathname } = useLocation();
  const area = areaOfPath(tree, pathname);
  if (!area) return <>{children}</>;
  return (
    <>
      <div className={styles.frame}>
        <p className={styles.eyebrow}>{area.label}</p>
        {area.items.length > 1 ? (
          <nav aria-label={t.nav.areaTabs(area.label)} className={styles.tabs}>
            {area.items.map((i) => {
              const active = pathname === i.to || pathname.startsWith(`${i.to}/`);
              return (
                <Link
                  key={i.to}
                  to={i.to}
                  className={styles.tab}
                  aria-current={active ? 'page' : undefined}
                >
                  {i.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </div>
      {children}
    </>
  );
}
