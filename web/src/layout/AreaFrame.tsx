import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { createPortal } from 'react-dom';
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
  useHeroTargets,
  type HeroArea,
  type HeroControls,
  type HeroTargets,
} from '@/core/shell/heroContext';
import { HeroFigure } from '@/ui/identity';
import {
  headHeight,
  SIGNATURE_SLOTS,
  type HeadVariant,
  type ModuleHue,
  type PageLayout,
} from '@/core/modules/types';
import { readHeadRoom, writeHeadRoom } from './headRoom';
import { PageContainer, PageFallback } from './PageContainer';
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
  // C31: on the phone the short verb shows ("Eintragen") – a tooltip never shows on touch; the full name stays
  // the accessible name and the tooltip.
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
      <span className={styles.writeShort} aria-hidden="true">
        {t.ai.palette.write}
      </span>
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

/** Heads whose page puts a figure under the title (MODULE-IDENTITY "Head variants"); `fokus` without the caps label. */
const FIGURE_HEADS: Readonly<Partial<Record<HeadVariant, 'label' | 'plain'>>> = {
  kennzahl: 'label',
  fortschritt: 'label',
  regal: 'label',
  fokus: 'plain',
};
/**
 * How long after the page arrived the frame keeps the figure's room while the page reads its data (U01). Pages fill
 * the figure within a few frames; a page without one gives the room back after this (and the next visit keeps none).
 */
const FIGURE_HOLD_MS = 1000;

/** The fallback tells the frame that the page's chunk is still loading. */
const PageLoadingContext = createContext<((loading: boolean) => void) | undefined>(undefined);

/**
 * Keeps the figure's room from the first paint until the page has been there for `FIGURE_HOLD_MS` (the figure itself
 * replaces the placeholder in CSS as soon as the page fills the slot).
 */
function useFigureHold(): [boolean, (loading: boolean) => void] {
  const [loading, setLoadingState] = useState(false);
  const [elapsed, setElapsed] = useState(false);
  const setLoading = useCallback((next: boolean) => {
    setLoadingState(next);
    if (next) setElapsed(false);
  }, []);
  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => setElapsed(true), FIGURE_HOLD_MS);
    return () => clearTimeout(timer);
  }, [loading]);
  return [loading || !elapsed, setLoading];
}

/**
 * Suspense fallback of a module page inside the frame (U01): while the module's chunk loads, the head already holds a
 * line in the title's place (the module's name, not a heading: tests and the reader wait for the page's own h1), so
 * the band has its final rows from the first paint and nothing below it moves when the page arrives.
 */
export function ModulePageFallback({ title }: { title: string }) {
  const hero = useHeroTargets();
  const setLoading = useContext(PageLoadingContext);
  useLayoutEffect(() => {
    setLoading?.(true);
    return () => setLoading?.(false);
  }, [setLoading]);
  return (
    <>
      {hero?.title
        ? createPortal(
            <p className={styles.titlePlaceholder} aria-hidden="true">
              {title}
            </p>,
            hero.title,
          )
        : null}
      <PageFallback />
    </>
  );
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
  route,
  children,
}: {
  /** Width variant of the page (`manifest.layout`, resolved by the router). */
  variant?: PageLayout;
  /** The route's path pattern (`/people/:id`): the head remembers its figure's room per route (U01). */
  route?: string;
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
  const { figure: headline, pending: headlinePending } = useModuleHeadline(manifest);
  const [figureHold, setPageLoading] = useFigureHold();
  const framed = !!area && !isFocusPath(pathname);
  const id = manifest?.identity;
  const slot = id ? SIGNATURE_SLOTS[id.head] : 'none';
  const figureShape = id ? FIGURE_HEADS[id.head] : undefined;
  // U01: while the page loads, the row under the title keeps the room it took on the last visit of this route; on a
  // first visit an empty figure of the head variant's shape holds the figure's place (the frame's own headline too).
  const roomKey = route ?? manifest?.id;
  const remembered = useMemo(() => (roomKey ? readHeadRoom(roomKey) : undefined), [roomKey]);
  const holdRoom = figureHold && !!remembered;
  const figurePending =
    headlinePending ||
    (!headline &&
      figureHold &&
      remembered === undefined &&
      !!figureShape &&
      !manifest?.contributions?.headline);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bodyRef.current;
    if (figureHold || !framed || !roomKey || !el) return;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    writeHeadRoom(roomKey, el.getBoundingClientRect().height / rem);
  }, [figureHold, framed, roomKey]);
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
                <div
                  className={styles.body}
                  ref={bodyRef}
                  data-hold={holdRoom ? 'true' : undefined}
                  style={
                    holdRoom ? ({ '--head-room': `${remembered}rem` } as CSSProperties) : undefined
                  }
                >
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
                    ) : figurePending ? (
                      // U01: an empty figure of the same shape holds the row until the number is there.
                      <div
                        className={styles.figurePending}
                        aria-hidden="true"
                        data-testid="module-figure-pending"
                      >
                        <HeroFigure
                          label={figureShape === 'plain' ? undefined : '\u00a0'}
                          value={'\u00a0'}
                          detail={'\u00a0'}
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
          <PageLoadingContext.Provider value={setPageLoading}>
            {children}
          </PageLoadingContext.Provider>
        </PageContainer>
      </HeroControlsContext.Provider>
    </HeroContext.Provider>
  );
}
