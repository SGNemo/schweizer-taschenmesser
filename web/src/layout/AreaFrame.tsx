import type { ReactNode } from 'react';
import { useLocation } from 'react-router';
import { isFocusPath } from '@/core/focus/path';
import { useAiWriteSettings } from '@/core/ai/write/settings';
import { areaOfPath } from '@/core/modules/areas';
import { availableManifests } from '@/core/modules/available';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button, Icon, Tabs } from '@/ui';
import { useNavTree } from './useNavItems';
import styles from './AreaFrame.module.css';

/**
 * Frame of a module page that belongs to an area: the area name as eyebrow and, when the area has
 * more than one enabled module, its modules as tabs. Pure navigation; the module renders below.
 */
/** "Mit KI eintragen" for a module that declares AI actions (and the user has not switched them off). */
function WriteButton({ pathname }: { pathname: string }) {
  const open = useUiStore((s) => s.openWritePalette);
  const [settings] = useAiWriteSettings();
  const manifest = availableManifests().find(
    (m) => pathname === `/${m.id}` || pathname.startsWith(`/${m.id}/`),
  );
  const hasActions = Object.keys(manifest?.aiSchema?.actions ?? {}).length > 0;
  if (!manifest || !hasActions || !settings?.enabled || settings.modulesOff.includes(manifest.id))
    return null;
  return (
    <Button variant="ghost" onClick={open} data-testid="ai-write-button">
      <Icon name="sparkles" size={16} /> {t.ai.palette.writeButton}
    </Button>
  );
}

export function AreaFrame({ children }: { children: ReactNode }) {
  const tree = useNavTree();
  const { pathname } = useLocation();
  const area = areaOfPath(tree, pathname);
  if (!area || isFocusPath(pathname)) return <>{children}</>;
  return (
    <>
      <div className={styles.frame}>
        <div className={styles.eyebrowRow}>
          <p className={styles.eyebrow}>{area.label}</p>
          <WriteButton pathname={pathname} />
        </div>
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
