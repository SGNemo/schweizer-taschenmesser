import type { ReactNode } from 'react';
import { useLocation } from 'react-router';
import { isFocusPath } from '@/core/focus/path';
import { areaOfPath } from '@/core/modules/areas';
import { usePageChromeStore } from '@/core/shell/pageChrome';
import { useWriteAvailable, useWriteLabel } from '@/core/shell/writeAvailable';
import { availableManifests } from '@/core/modules/available';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { moduleSettingsPath } from '@/pages/settings/useSections';
import { tComfort } from '@/strings.comfort';
import { Button, Icon, SettingsLink, Tabs } from '@/ui';
import { useNavTree } from './useNavItems';
import styles from './AreaFrame.module.css';

/**
 * Frame of a module page that belongs to an area: the area name as eyebrow and, when the area has
 * more than one enabled module, its modules as tabs. Pure navigation; the module renders below.
 */
/** "Mit KI eintragen" for a module that declares AI actions (and the user has not switched them off). */
function WriteButton({ pathname }: { pathname: string }) {
  const open = useUiStore((s) => s.openWritePalette);
  const writeInMenu = usePageChromeStore((s) => s.chrome.writeInMenu);
  const manifest = availableManifests().find(
    (m) => pathname === `/${m.id}` || pathname.startsWith(`/${m.id}/`),
  );
  const available = useWriteAvailable(manifest?.id);
  const write = useWriteLabel();
  if (!available || writeInMenu) return null;
  return (
    <Button variant="ghost" onClick={open} data-testid="ai-write-button">
      <Icon name={write.ai ? 'sparkles' : 'plus'} size={16} /> {write.label}
    </Button>
  );
}

/** The gear of the module whose page this is: straight to its settings section. */
function ModuleSettingsLink({ pathname }: { pathname: string }) {
  const manifest = availableManifests().find(
    (m) => pathname === `/${m.id}` || pathname.startsWith(`/${m.id}/`),
  );
  const to = manifest ? moduleSettingsPath(manifest) : undefined;
  if (!manifest || !to) return null;
  return <SettingsLink to={to} label={tComfort.get().gear.module} />;
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
          <ModuleSettingsLink pathname={pathname} />
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
