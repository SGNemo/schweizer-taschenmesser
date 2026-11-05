import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
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
import { Button, HeadEyebrow, HeadSurface, Icon, SettingsLink, SubNav } from '@/ui';
import {
  EMPTY_HERO,
  HeroContext,
  HeroControlsContext,
  type HeroArea,
  type HeroControls,
  type HeroTargets,
} from '@/core/shell/heroContext';
import { HeroFigure } from '@/ui/identity';
import { headHeight, SIGNATURE_SLOTS, type ModuleHue, type PageLayout } from '@/core/modules/types';
import { PageContainer } from './PageContainer';
import { DefaultSignature } from './signatures';
import { useHeroCollapse } from './useHeroCollapse';
import { useModuleHeadline } from './useModuleHeadline';
import { useNavTree } from './useNavItems';
import styles from './AreaFrame.module.css';

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
  // On the phone only the icon shows: the name stays as the tooltip and the accessible name.
  return (
    <Button
      variant="ghost"
      onClick={open}
      data-testid="ai-write-button"
      aria-label={write.label}
      title={write.label}
    >
      <Icon name={write.ai ? 'sparkles' : 'plus'} size={16} />
      <span className={styles.writeLabel}>{write.label}</span>
    </Button>
  );
}

/** One stable ref callback per hero area (a new function would re-run every portal on every render). */
function useTarget(
  area: HeroArea,
  setTargets: Dispatch<SetStateAction<HeroTargets>>,
): (el: HTMLElement | null) => void {
  return useCallback(
    (el: HTMLElement | null) => setTargets((c) => (c[area] === el ? c : { ...c, [area]: el })),
    [area, setTargets],
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

/**
 * The module frame (identity v3.1, docs/design/MODULE-IDENTITY.md "Head variants"): every module page sits in it. A
 * full-width band in the module's hue and the area's pattern (`HeadSurface`) holds, in a content column capped at
 * `--page-content` and aligned to the page, the page's h1 (`PageHeader` renders it into the head), then one row:
 * the headline figure, the signature slot (sized by the head variant; the frame draws the module's signature until
 * the page fills it with `HeroSlot area="signature"`) and the free slot for strips and controls. The actions sit at
 * the band's right edge. Under it the area's other modules as a quiet sub-navigation, then the page in its
 * `PageContainer`. On the phone the band shrinks to a one-line bar when the page is scrolled. Outside an area
 * (library, settings, focus screens) it is just the container.
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
  const setNotice = useTarget('notice', setTargets);
  const setBackdrop = useTarget('backdrop', setTargets);
  const setTitle = useTarget('title', setTargets);
  const setFigure = useTarget('figure', setTargets);
  const setSignature = useTarget('signature', setTargets);
  const setExtra = useTarget('extra', setTargets);
  // Areas the page has claimed with a HeroSlot (the frame's defaults step back) and the title text for the compact bar.
  const [claims, setClaims] = useState<Record<string, number>>({});
  const [titleText, setTitleText] = useState<string>();
  const controls = useMemo<HeroControls>(
    () => ({
      claim: (area) => {
        setClaims((c) => ({ ...c, [area]: (c[area] ?? 0) + 1 }));
        return () => setClaims((c) => ({ ...c, [area]: Math.max(0, (c[area] ?? 1) - 1) }));
      },
      setTitle: setTitleText,
    }),
    [],
  );
  const claimed = (area: HeroArea) => (claims[area] ?? 0) > 0;
  const collapsed = useHeroCollapse();
  const headline = useModuleHeadline(manifest);
  const framed = !!area && !isFocusPath(pathname);
  const id = manifest?.identity;
  const slot = id ? SIGNATURE_SLOTS[id.head] : 'none';
  return (
    <HeroContext.Provider value={framed ? targets : undefined}>
      <HeroControlsContext.Provider value={framed ? controls : undefined}>
        {framed ? <div className={styles.notice} ref={setNotice} /> : null}
        {framed ? (
          <HeadSurface
            bleed
            className={styles.band}
            hue={id?.hue}
            hue2={id?.hue2}
            area={area?.id}
            size={id ? headHeight(id.head) : 'hero'}
            head={id?.head}
            shape={id?.shape}
            type={id?.type}
            signature={id?.signature}
            slot={slot}
            backdropRef={setBackdrop}
            testId="module-frame"
          >
            <div className={styles.inner} data-width={variant}>
              <HeadEyebrow icon={manifest?.icon} className={styles.eyebrow}>
                {area?.label}
                {manifest ? ` · ${manifest.name}` : ''}
              </HeadEyebrow>
              <div className={styles.actions}>
                <WriteButton pathname={pathname} />
                <ModuleSettingsLink pathname={pathname} />
              </div>
              <div className={styles.column}>
                <div className={styles.title} ref={setTitle} />
                <div className={styles.body}>
                  <div className={styles.figure}>
                    <div className={styles.target} ref={setFigure} />
                    {headline && !claimed('figure') ? (
                      <div data-testid="module-headline">
                        <HeroFigure
                          label={headline.label}
                          value={headline.value}
                          detail={headline.detail}
                          type={id?.type}
                        />
                      </div>
                    ) : null}
                  </div>
                  {id && slot !== 'none' && (id.signature !== 'none' || claimed('signature')) ? (
                    <div
                      className={styles.signature}
                      data-slot={slot}
                      data-default={claimed('signature') ? undefined : 'true'}
                      data-testid="module-signature"
                    >
                      <div className={styles.target} ref={setSignature} />
                      {claimed('signature') ? null : (
                        <DefaultSignature id={id.signature} size={slot} />
                      )}
                    </div>
                  ) : null}
                  <div className={styles.extra} ref={setExtra} />
                </div>
              </div>
            </div>
          </HeadSurface>
        ) : null}
        {framed ? (
          <div
            className={styles.compact}
            data-visible={collapsed ? 'true' : undefined}
            data-hue={id?.hue}
            data-hue2={id?.hue2}
            aria-hidden="true"
            data-testid="module-compact"
          >
            {manifest ? <Icon name={manifest.icon} size={16} /> : null}
            <span className={styles.compactName}>{titleText || manifest?.name}</span>
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
      </HeroControlsContext.Provider>
    </HeroContext.Provider>
  );
}
