import type { ReactNode } from 'react';
import { useLocation } from 'react-router';
import { areaOfPath } from '@/core/modules/areas';
import { t } from '@/strings';
import { Tabs } from '@/ui';
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
          <Tabs
            label={t.nav.areaTabs(area.label)}
            items={area.items.map((i) => ({
              id: i.to,
              label: i.label,
              to: i.to,
              active: pathname === i.to || pathname.startsWith(`${i.to}/`),
            }))}
          />
        ) : null}
      </div>
      {children}
    </>
  );
}
