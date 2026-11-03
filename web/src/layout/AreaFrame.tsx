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
import { Button, Icon, SettingsLink, SubNav } from '@/ui';
import { EMPTY_HERO, HeroContext, type HeroTargets } from '@/core/shell/heroContext';
import { DayBlock, HeroFigure, HourStrip } from '@/ui/identity';
import { useCalendarItems } from '@/core/modules/contributions';
import { headHeight, type ModuleHue, type PageLayout } from '@/core/modules/types';
import { dateTimeFormat } from '@/core/i18n/format';
import { formatDay, nowTime } from '@/core/time/dates';
import { today } from '@/core/time/now';
import { tIdentity } from '@/strings.identity';
import { PageContainer } from './PageContainer';
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
    <Button variant="ghost" onClick={open} data-testid="ai-write-button" aria-label={write.label}>
      <Icon name={write.ai ? 'sparkles' : 'plus'} size={16} />
      <span className={styles.writeLabel}>{write.label}</span>
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

/** Today as the figure of a `zeit` head whose signature is the calendar: the day number large, month, weekday and week. */
function TodayBlock() {
  const day = today();
  const date = new Date(`${day}T12:00:00`);
  return (
    <DayBlock
      day={String(date.getDate())}
      month={dateTimeFormat({ month: 'long' }).format(date)}
      weekday={dateTimeFormat({ weekday: 'long' }).format(date)}
      week={tIdentity.get().head.week(formatDay(day, 'II'))}
    />
  );
}

/** The hours of today, filled where an appointment (any module's calendar contribution) lies; beside the day number. */
function TodayStrip() {
  const day = today();
  const items = useCalendarItems({ from: day, to: day });
  const timed = (items ?? []).filter((i) => !i.allDay && !i.done && !!i.time);
  return (
    <HourStrip events={timed.map((i) => ({ time: i.time!, endTime: i.endTime }))} now={nowTime()} />
  );
}

/** CSS length of the head's content column: the page variant's width plus the gutters the band bleeds through. */
const headMax = (variant: PageLayout): string =>
  variant === 'full'
    ? 'none'
    : `calc(var(--page-${variant}) + 2 * var(--frame-bleed-x, var(--space-5)))`;

/**
 * The module frame (identity v3, `docs/design/identity-v3/02-CONCEPT.md`): every module page sits in it. A full-width band
 * ("head") in the module's hue and the area's pattern holds the eyebrow with the icon plate, the page's h1
 * (`PageHeader` renders it into the head), the headline figure or the module's signature (`HeroSlot`) and the actions.
 * The variant (`identity.head`) sets its height and silhouette. Under it the area's other modules as a quiet sub-navigation,
 * then the page in its `PageContainer` (one width per page variant). On the phone the band shrinks to a one-line bar when
 * the page is scrolled. Outside an area (library, settings, focus screens) it is just the container.
 */
export function AreaFrame({
  variant = 'wide',
  hue,
  children,
}: {
  /** Width variant of the page (`manifest.layout`, resolved by the router). */
  variant?: PageLayout;
  /** The module's hue for the page container (`data-hue`). */
  hue?: ModuleHue;
  children: ReactNode;
}) {
  const tree = useNavTree();
  const { pathname } = useLocation();
  const area = areaOfPath(tree, pathname);
  const manifest = availableManifests().find(
    (m) => pathname === `/${m.id}` || pathname.startsWith(`/${m.id}/`),
  );
  const [targets, setTargets] = useState<HeroTargets>(EMPTY_HERO);
  const setNotice = useCallback(
    (el: HTMLElement | null) => setTargets((c) => (c.notice === el ? c : { ...c, notice: el })),
    [],
  );
  const setBackdrop = useCallback(
    (el: HTMLElement | null) => setTargets((c) => (c.backdrop === el ? c : { ...c, backdrop: el })),
    [],
  );
  const setTitle = useCallback(
    (el: HTMLElement | null) => setTargets((c) => (c.title === el ? c : { ...c, title: el })),
    [],
  );
  const setFigure = useCallback(
    (el: HTMLElement | null) => setTargets((c) => (c.figure === el ? c : { ...c, figure: el })),
    [],
  );
  const setExtra = useCallback(
    (el: HTMLElement | null) => setTargets((c) => (c.extra === el ? c : { ...c, extra: el })),
    [],
  );
  const collapsed = useHeroCollapse();
  const headline = useModuleHeadline(manifest);
  const framed = !!area && !isFocusPath(pathname);
  const id = manifest?.identity;
  const style = {
    ...(id?.hue2 ? { '--module-color-2': `var(--mod-${id.hue2})` } : {}),
    '--head-max': headMax(variant),
  } as CSSProperties;
  return (
    <HeroContext.Provider value={framed ? targets : undefined}>
      {framed ? <div className={styles.notice} ref={setNotice} /> : null}
      {framed ? (
        <div
          className={styles.band}
          data-hue={id?.hue}
          data-head={id?.head}
          data-size={id ? headHeight(id.head) : undefined}
          data-area={area?.id}
          data-shape={id?.shape}
          data-type={id?.type}
          data-signature={id?.signature}
          style={style}
          data-testid="module-frame"
        >
          <div className={styles.pattern} aria-hidden="true" />
          <div className={styles.backdrop} ref={setBackdrop} aria-hidden="true" />
          <div className={styles.inner}>
            <p className={styles.eyebrow}>
              {manifest ? (
                <span className={styles.plate} aria-hidden="true">
                  <Icon name={manifest.icon} size={16} />
                </span>
              ) : null}
              <span>
                {area?.label}
                {manifest ? ` · ${manifest.name}` : ''}
              </span>
            </p>
            <div className={styles.title} ref={setTitle} />
            <div className={styles.figure} ref={setFigure}>
              {headline ? (
                <div data-testid="module-headline">
                  <HeroFigure
                    label={headline.label}
                    value={headline.value}
                    detail={headline.detail}
                    type={id?.type}
                  />
                </div>
              ) : id?.signature === 'calendarLeaf' ? (
                <TodayBlock />
              ) : null}
            </div>
            <div className={styles.extra} ref={setExtra}>
              {id?.signature === 'calendarLeaf' ? <TodayStrip /> : null}
            </div>
            <div className={styles.actions}>
              <WriteButton pathname={pathname} />
              <ModuleSettingsLink pathname={pathname} />
            </div>
          </div>
        </div>
      ) : null}
      {framed ? (
        <div
          className={styles.compact}
          data-visible={collapsed ? 'true' : undefined}
          data-hue={id?.hue}
          style={style}
          aria-hidden="true"
          data-testid="module-compact"
        >
          {manifest ? <Icon name={manifest.icon} size={16} /> : null}
          <span className={styles.compactName}>{targets.title?.textContent || manifest?.name}</span>
        </div>
      ) : null}
      <PageContainer variant={variant} hue={hue}>
        {framed && area && area.items.length > 1 ? (
          <SubNav
            label={t.nav.areaTabs(area.label)}
            eyebrow={area.label}
            items={area.items.map((i) => ({
              id: i.to,
              label: i.label,
              to: i.to,
              icon: i.icon,
              hue: i.hue,
              active: pathname === i.to || pathname.startsWith(`${i.to}/`),
            }))}
          />
        ) : null}
        {children}
      </PageContainer>
    </HeroContext.Provider>
  );
}
