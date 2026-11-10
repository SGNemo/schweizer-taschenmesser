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
import { logLine } from '@/core/diagnostics/errorLog';
import { isFocusPath } from '@/core/focus/path';
import { areaOfPath } from '@/core/modules/areas';
import { availableManifests } from '@/core/modules/available';
import { ModuleIdentityContext } from '@/core/modules/identityContext';
import { t } from '@/strings';
import { PAGE_SLOW_MS, PAGE_STUCK_MS } from './PageLoadingCard';
import { moduleSettingsPath } from '@/pages/settings/useSections';
import { tComfort } from '@/strings.comfort';
import { HeadSurface, Icon, PHONE_QUERY, SettingsLink, SubNav, useMediaQuery } from '@/ui';
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
  SIGNATURE_SLOTS,
  type ModuleManifest,
  type ModuleHue,
  type PageLayout,
} from '@/core/modules/types';
import { useFigureHold } from './figureHold';
import { readHeadRoom, writeHeadRoom } from './headRoom';
import { PageContainer, PageFallback } from './PageContainer';
import { DefaultSignature } from './signatures';
import { useModuleHeadline } from './useModuleHeadline';
import { useNavTree } from './useNavItems';
import styles from './AreaFrame.module.css';

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

/** The fallback tells the frame that the page's chunk is still loading. */
const PageLoadingContext = createContext<((loading: boolean) => void) | undefined>(undefined);

/**
 * Suspense fallback of a module page inside the frame (U01): while the module's chunk loads, the head already holds a
 * line in the title's place (the module's name, not a heading: tests and the reader wait for the page's own h1), so
 * the title row has its final height from the first paint and nothing below it moves when the page arrives. The name is read
 * at render time (a language switch shows the new one).
 */
export function ModulePageFallback({ manifest }: { manifest: ModuleManifest }) {
  const hero = useHeroTargets();
  const setLoading = useContext(PageLoadingContext);
  useLayoutEffect(() => {
    setLoading?.(true);
    return () => setLoading?.(false);
  }, [setLoading]);
  // A page that is still not there is worth a line in the diagnostics log: the module id only, never a path.
  const { id } = manifest;
  useEffect(() => {
    const timer = setTimeout(
      () => logLine('warn', `module-${id}`, 'page still loading after 15 s'),
      PAGE_STUCK_MS,
    );
    return () => clearTimeout(timer);
  }, [id]);
  return (
    <>
      {hero?.title
        ? createPortal(
            <p className={styles.titlePlaceholder} aria-hidden="true">
              {manifest.name}
            </p>,
            hero.title,
          )
        : null}
      <PageFallback delay={PAGE_SLOW_MS} />
    </>
  );
}

/**
 * The module frame (Identity 4.0, docs/design/MODULE-IDENTITY.md "4.0"): every module page sits in it. The head is
 * one **title row** in the width of the content (plate, eyebrow "area · context", the page's h1, one figure with its
 * context line and, on the desktop, the page's actions with the one filled module action) with the page's tabs at its
 * lower edge; it stays at the top while the page scrolls. Two variants: `standard` (plain surface, no pattern, no
 * signature slot) and `stage` (weather, music: the same title row above a stage with backdrop, figure and signature).
 * The area's other modules are no longer a row of their own on the desktop (the sidebar lists them); on the phone
 * they are the one module row under the title row. Under a standard head the page's signature block and its strips
 * lie in the page. Outside an area (library, settings, focus screens) it is just the container.
 */
export function AreaFrame({
  variant = 'wide',
  hue,
  route,
  children,
}: {
  /** Width variant of the page (`manifest.layout`, resolved by the router). */
  variant?: PageLayout;
  /** The route's path pattern (`/people/:id`): a stage remembers its room per route (U01). */
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
  const setActions = useTarget('actions', setTargets);
  const setTabs = useTarget('tabs', setTargets);
  const setSignature = useTarget('signature', setTargets);
  const setExtra = useTarget('extra', setTargets);
  // Areas the page has claimed with a HeroSlot (the frame's defaults step back) and the page's title text.
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
  const { figure: headline, pending: headlinePending } = useModuleHeadline(manifest);
  const framed = !!area && !isFocusPath(pathname);
  const id = manifest?.identity;
  const stage = id?.head === 'stage';
  const slot = id ? SIGNATURE_SLOTS[id.head] : 'none';
  const phone = useMediaQuery(PHONE_QUERY);
  // U01 (stage only; the standard title row has one height whatever is in it): while the page loads, the stage
  // keeps the room it took on the last visit of this route. Per layout too: the phone's room differs from the desktop's.
  const routeKey = route ?? manifest?.id;
  const roomKey = routeKey && stage ? `${routeKey}@${phone ? 'phone' : 'wide'}` : undefined;
  // The hold restarts for every route (and layout), so the room is measured only once that route's page is there.
  const [figureHold, setPageLoading] = useFigureHold(roomKey);
  const remembered = useMemo(() => (roomKey ? readHeadRoom(roomKey) : undefined), [roomKey]);
  const holdRoom = figureHold && !!remembered;
  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stageRef.current;
    if (figureHold || !framed || !roomKey || !el) return;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    writeHeadRoom(roomKey, el.getBoundingClientRect().height / rem);
  }, [figureHold, framed, roomKey]);
  // Dialogs opened inside the page wear the module's identity in their head (S02, `ui/Dialog`).
  const dialogIdentity = useMemo(
    () =>
      manifest
        ? {
            hue: manifest.identity.hue,
            icon: manifest.icon,
            signature: manifest.identity.signature,
          }
        : undefined,
    [manifest],
  );
  // Eyebrow "area · context": the module's name is the context once the page's title is another one (a sub-page).
  const context = manifest && titleText && titleText !== manifest.name ? manifest.name : undefined;
  const figure = (
    <div className={styles.figure} data-testid="module-figure">
      <div className={styles.target} ref={setFigure} />
      {headline && !claimed('figure') ? (
        <div data-testid="module-headline">
          <HeroFigure
            label={headline.label}
            value={headline.value}
            detail={headline.detail}
            type={id?.type}
            sensitive={headline.sensitive}
          />
        </div>
      ) : headlinePending ? (
        // U01: an empty figure of the same shape holds the place until the number is there.
        <div
          className={styles.figurePending}
          aria-hidden="true"
          data-testid="module-figure-pending"
        >
          <HeroFigure value={' '} detail={' '} type={id?.type} />
        </div>
      ) : null}
    </div>
  );
  const titleRow = (
    <div className={styles.titleRow} data-testid="module-title-row">
      {manifest ? (
        <span className={styles.plate} aria-hidden="true">
          <Icon name={manifest.icon} size={18} />
        </span>
      ) : null}
      <div className={styles.titleBlock}>
        <p className={styles.eyebrow} data-testid="module-eyebrow">
          {area?.label}
          {context ? ` · ${context}` : ''}
        </p>
        <div className={styles.title} ref={setTitle} data-slot="title" />
      </div>
      {stage ? null : figure}
      <div className={styles.actions} data-testid="module-actions">
        <div className={styles.target} ref={setActions} />
        {/* The phone's head holds no control (rule 4); a module's settings stay under Einstellungen → Module. */}
        {phone ? null : <ModuleSettingsLink pathname={pathname} />}
      </div>
    </div>
  );
  // Phone: the area's modules as the one row under the title row (rule 3); on the desktop the sidebar lists them.
  const moduleRow =
    phone && area && area.items.length > 1 ? (
      <SubNav
        label={t.nav.areaTabs(area.label)}
        items={area.items.map((i) => ({
          id: i.to,
          label: i.label,
          to: i.to,
          icon: i.icon,
          hue: i.hue,
          active: pathname === i.to || pathname.startsWith(`${i.to}/`),
        }))}
      />
    ) : null;
  // U01: on the module's entry page the row of the tabs is there from the first paint when the manifest says the page
  // has views (`identity.tabs`); the page's code arrives later and must not push the content down.
  const expectTabs = !!id?.tabs && !!manifest && pathname === `/${manifest.id}`;
  const tabs = (
    <div
      className={styles.tabs}
      ref={setTabs}
      data-slot="tabs"
      data-hold={expectTabs ? 'true' : undefined}
    />
  );
  return (
    <HeroContext.Provider value={framed ? targets : undefined}>
      <HeroControlsContext.Provider value={framed ? controls : undefined}>
        {framed ? <div className={styles.notice} ref={setNotice} /> : null}
        {framed && !stage ? (
          <header
            className={styles.head}
            data-head="standard"
            data-hue={id?.hue}
            data-hue2={id?.hue2}
            data-area={area?.id}
            data-type={id?.type}
            data-signature={id?.signature}
            data-slot={slot}
            data-testid="module-frame"
          >
            <div className={styles.inner} data-width={variant}>
              {titleRow}
              {moduleRow}
              {tabs}
            </div>
          </header>
        ) : null}
        {framed && stage ? (
          <HeadSurface
            as="header"
            bleed
            className={styles.stage}
            hue={id?.hue}
            hue2={id?.hue2}
            area={area?.id}
            head="stage"
            shape={id?.shape}
            type={id?.type}
            signature={id?.signature}
            slot={slot}
            backdropRef={setBackdrop}
            testId="module-frame"
          >
            <div className={styles.inner} data-width={variant}>
              {titleRow}
              {moduleRow}
              <div
                className={styles.stageBody}
                ref={stageRef}
                data-hold={holdRoom ? 'true' : undefined}
                style={
                  holdRoom ? ({ '--head-room': `${remembered}rem` } as CSSProperties) : undefined
                }
              >
                {figure}
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
              {tabs}
            </div>
          </HeadSurface>
        ) : null}
        <PageContainer variant={variant} hue={hue}>
          {framed && !stage ? (
            // Under a standard head: what a page still brings for the signature slot and its strips lies in the
            // page (the area packages decide what stays), never in the head.
            <div className={styles.below} data-testid="module-below">
              <div className={styles.target} ref={setSignature} data-slot="signature" />
              <div className={styles.target} ref={setExtra} data-slot="extra" />
            </div>
          ) : null}
          {/* The fallback (U01) and the page both sit inside both providers. */}
          <ModuleIdentityContext.Provider value={dialogIdentity}>
            <PageLoadingContext.Provider value={setPageLoading}>
              {children}
            </PageLoadingContext.Provider>
          </ModuleIdentityContext.Provider>
        </PageContainer>
      </HeroControlsContext.Provider>
    </HeroContext.Provider>
  );
}
