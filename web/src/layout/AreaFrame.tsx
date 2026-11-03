import { useCallback, useState, type CSSProperties, type ReactNode } from 'react';
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
import { HeroContext, type HeroTargets } from '@/core/shell/heroContext';
import { CalendarLeaf, HeroFigure } from '@/ui/identity';
import { dateTimeFormat } from '@/core/i18n/format';
import { today } from '@/core/time/now';
import { useHeroCollapse } from './useHeroCollapse';
import { useModuleHeadline } from './useModuleHeadline';
import { useNavTree } from './useNavItems';
import styles from './AreaFrame.module.css';

/**
 * Frame of a module page that belongs to an area: the area name as eyebrow and, when the area has
 * more than one enabled module, its modules as tabs. Pure navigation; the module renders below.
 * On a phone it is one line (label, scrollable tabs, actions); on the desktop the tabs sit below.
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

/** Today's leaf for modules whose signature is the calendar leaf. */
function TodayLeaf() {
  const date = new Date(`${today()}T12:00:00`);
  return (
    <CalendarLeaf
      month={dateTimeFormat({ month: 'short' }).format(date)}
      day={String(date.getDate())}
      weekday={dateTimeFormat({ weekday: 'long' }).format(date)}
    />
  );
}

/**
 * The module frame ("hero" + page, DECISIONS ui-shell "Module identity v2"): every module page sits in it. Zones: eyebrow
 * with the module chip and the area's tabs, the title (the page's `PageHeader` renders its h1 into the head), the headline
 * figure or the module's signature (`HeroSlot`), and the actions. The head carries the module hue as a gradient; on the phone
 * it shrinks to one line when the page is scrolled. Everything below the head is the module's own toolbar and content.
 */
export function AreaFrame({ children }: { children: ReactNode }) {
  const tree = useNavTree();
  const { pathname } = useLocation();
  const area = areaOfPath(tree, pathname);
  const manifest = availableManifests().find(
    (m) => pathname === `/${m.id}` || pathname.startsWith(`/${m.id}/`),
  );
  const [targets, setTargets] = useState<HeroTargets>({ title: null, extra: null });
  const titleRef = useCallback(
    (el: HTMLElement | null) => setTargets((c) => (c.title === el ? c : { ...c, title: el })),
    [],
  );
  const extraRef = useCallback(
    (el: HTMLElement | null) => setTargets((c) => (c.extra === el ? c : { ...c, extra: el })),
    [],
  );
  const collapsed = useHeroCollapse();
  const headline = useModuleHeadline(manifest);
  if (!area || isFocusPath(pathname)) return <>{children}</>;
  const id = manifest?.identity;
  const style = id?.hue2
    ? ({ '--module-color-2': `var(--mod-${id.hue2})` } as CSSProperties)
    : undefined;
  return (
    <HeroContext.Provider value={targets}>
      <div
        className={styles.frame}
        data-tabs={area.items.length > 1 ? 'true' : undefined}
        data-hue={id?.hue}
        data-head={id?.head}
        data-surface={id?.surface}
        data-shape={id?.shape}
        data-type={id?.type}
        data-signature={id?.signature}
        data-collapsed={collapsed ? 'true' : undefined}
        style={style}
        data-testid="module-frame"
      >
        <p className={styles.eyebrow}>
          {manifest ? (
            <span className={styles.chip} aria-hidden="true">
              <Icon name={manifest.icon} size={16} />
            </span>
          ) : null}
          {area.label}
        </p>
        <div className={styles.title} ref={titleRef} />
        {area.items.length > 1 ? (
          <div className={styles.tabs}>
            <Tabs
              label={t.nav.areaTabs(area.label)}
              items={area.items.map((i) => ({
                id: i.to,
                label: i.label,
                to: i.to,
                active: pathname === i.to || pathname.startsWith(`${i.to}/`),
              }))}
            />
          </div>
        ) : null}
        {headline ? (
          <div className={styles.figure} data-testid="module-headline">
            <HeroFigure
              label={headline.label}
              value={headline.value}
              detail={headline.detail}
              type={id?.type}
            />
          </div>
        ) : null}
        <div className={styles.extra} ref={extraRef}>
          {id?.signature === 'calendarLeaf' ? <TodayLeaf /> : null}
        </div>
        <div className={styles.actions}>
          <WriteButton pathname={pathname} />
          <ModuleSettingsLink pathname={pathname} />
        </div>
      </div>
      {children}
    </HeroContext.Provider>
  );
}
