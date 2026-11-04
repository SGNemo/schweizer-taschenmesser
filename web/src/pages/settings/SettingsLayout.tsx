import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router';
import { advancedOpen, readAdvancedOpen, writeAdvancedOpen } from '@/core/settings/foldState';
import { isChanged } from '@/core/settings/changed';
import { useComfortSettings } from '@/core/settings/comfort';
import { useFocusSettings } from '@/core/settings/focus';
import { levelOf, scopeOf } from '@/core/settings/registry/meta';
import { frequentSections, recordSectionVisit } from '@/core/settings/frequent';
import { resetSection, type ResetPlan } from '@/core/settings/reset';
import { categoryDef, SETTINGS_CATEGORIES } from '@/core/settings/registry/categories';
import { groupSections } from '@/core/settings/registry/groups';
import { legacyTarget, moduleIdOfSection, settingsPath } from '@/core/settings/registry/paths';
import { sectionsOf, visibleCategoryIds } from '@/core/settings/registry/registry';
import { searchSettings } from '@/core/settings/registry/search';
import {
  isCategoryId,
  type SettingsCategoryId,
  type SettingsSectionDef,
} from '@/core/settings/registry/types';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { tComfort } from '@/strings.comfort';
import { tSettings2 } from '@/strings.settings2';
import { tSettingsV3 } from '@/strings.settingsV3';
import {
  Badge,
  Button,
  EmptyState,
  Icon,
  Skeleton,
  TextField,
  useMediaQuery,
  type IconName,
} from '@/ui';
import { Breadcrumb, type Crumb } from './Breadcrumb';
import { CATEGORY_LOOK, NAV_GROUPS, STATUS_LOOK } from './categoryLook';
import { PageHead } from './PageHead';
import { StatusHead } from './StatusHead';
import { CategoryStatus } from './CategoryStatus';
import { ModuleList, ModuleSettingsPage } from './ModuleSettingsPage';
import { QuickBar, QuickInline } from './QuickBar';
import { SettingsOverview } from './SettingsOverview';
import { SettingsToc } from './SettingsToc';
import { ScopeLabel } from './SettingExtras';
import { useSettingsSections } from './useSections';
import styles from './SettingsLayout.module.css';

/** Desktop two-column layout from this width; below it the categories are a list (first level). */
const MASTER_DETAIL_QUERY = '(min-width: 900px)';
/** Third column (table of contents) from this width. */
const TOC_QUERY = '(min-width: 1440px)';
/** How long a deep-linked settings section stays highlighted. */
const HIGHLIGHT_MS = 1600;

function SettingsSearch() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const sections = useSettingsSections();
  const results = useMemo(
    () => searchSettings(sections, SETTINGS_CATEGORIES, query),
    [sections, query],
  );
  const go = (r: (typeof results)[number]) => {
    setQuery('');
    void navigate(settingsPath(r.category, r.sectionId, r.fieldKey));
  };
  return (
    <div role="search" className={`${styles.search} ${styles.stickySearch}`}>
      <TextField
        label={t.settings.search}
        labelHidden
        type="search"
        placeholder={t.settings.searchPlaceholder}
        value={query}
        autoComplete="off"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) go(results[0]);
          if (e.key === 'Escape') setQuery('');
        }}
      />
      {query.trim() ? (
        <div className={styles.results} aria-label={t.settings.searchResults}>
          {results.length === 0 ? (
            <p role="status" className={styles.noResults}>
              {t.settings.noResults}
            </p>
          ) : (
            <ul className={styles.resultList}>
              {results.map((r) => (
                <li key={`${r.sectionId}:${r.fieldKey ?? ''}`}>
                  <Link
                    to={settingsPath(r.category, r.sectionId, r.fieldKey)}
                    onClick={() => setQuery('')}
                    className={styles.result}
                  >
                    <span>{r.label}</span>
                    <span className={styles.path}>{r.path}</span>
                  </Link>
                  {r.quick ? <QuickInline id={r.quick} /> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** The category id of the current `/settings/<id>[/…]` URL, if any. */
function useOpenCategory(): SettingsCategoryId | undefined {
  const { pathname } = useLocation();
  const id = /^\/settings\/([^/]+)/.exec(pathname)?.[1];
  return isCategoryId(id) ? id : undefined;
}

/** Second level under the open category: its groups, each jumping to the group's first section. */
function SubNav({ id }: { id: SettingsCategoryId }) {
  const sections = useSettingsSections();
  const g = tSettings2.use().groups as Record<string, string>;
  const groups = groupSections(id, sectionsOf(sections, id)).filter((x) => x.group);
  if (groups.length < 2) return null;
  return (
    <ul className={styles.subnav} data-testid={`subnav-${id}`}>
      {groups.map((x) => (
        <li key={x.group}>
          <Link to={settingsPath(id, x.sections[0]!.id)} className={styles.subLink}>
            {g[x.group!]}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Ids of the categories with at least one section that differs from its defaults (re-checked when the look or focus settings move). */
function useChangedCategories(): ReadonlySet<SettingsCategoryId> {
  const sections = useSettingsSections();
  const ui = useUiStore((st) => st);
  const [focus] = useFocusSettings();
  const [changed, setChanged] = useState<ReadonlySet<SettingsCategoryId>>(new Set());
  useEffect(() => {
    let live = true;
    const withPlan = sections.filter((x) => x.reset?.defaults);
    void Promise.all(withPlan.map((x) => isChanged(x.reset!).catch(() => false))).then((flags) => {
      if (!live) return;
      setChanged(new Set(withPlan.filter((_, i) => flags[i]).map((x) => x.category)));
    });
    return () => {
      live = false;
    };
  }, [sections, ui, focus]);
  return changed;
}

function CategoryLink({
  id,
  list,
  changed,
}: {
  id: SettingsCategoryId;
  list?: boolean;
  changed: boolean;
}) {
  const c = categoryDef(id);
  const look = CATEGORY_LOOK[id];
  const differs = tSettingsV3.use().differs;
  const open = useOpenCategory() === id;
  return (
    <>
      <NavLink
        to={`/settings/${id}`}
        className={list ? styles.listLink : styles.navLink}
        data-hue={look.hue}
      >
        <span className={styles.icon}>
          <Icon name={c.icon as IconName} />
        </span>
        <span className={styles.linkText}>
          <span className={styles.linkTitle}>
            {c.title}
            {changed ? (
              <>
                <span className={styles.dot} aria-hidden="true" data-testid={`differs-${id}`} />
                <span className="sr-only">{differs}</span>
              </>
            ) : null}
          </span>
          {list ? <span className={styles.linkDesc}>{c.description}</span> : null}
        </span>
        <CategoryStatus id={id} />
        {list ? <Icon name="chevronRight" /> : null}
      </NavLink>
      {open && !list ? <SubNav id={id} /> : null}
    </>
  );
}

/** The sections opened most often on this device (see `core/settings/frequent.ts`); empty until used. */
function FrequentNav({ list }: { list?: boolean }) {
  const sections = useSettingsSections();
  const [focus] = useFocusSettings();
  const ids = focus.searchHistory ? frequentSections(sections.map((x) => x.id)) : [];
  if (ids.length === 0) return null;
  const title = tComfort.get().frequent.title;
  return (
    <nav aria-label={title} className={`${list ? styles.list : styles.nav} ${styles.frequent}`}>
      <p className={styles.frequentTitle}>{title}</p>
      <ul>
        {ids.map((id) => {
          const sec = sections.find((x) => x.id === id)!;
          return (
            <li key={id}>
              <Link
                to={settingsPath(sec.category, sec.id)}
                className={list ? styles.listLink : styles.navLink}
              >
                <span className={styles.linkText}>
                  <span className={styles.linkTitle}>{sec.title}</span>
                  {list ? (
                    <span className={styles.linkDesc}>{categoryDef(sec.category).title}</span>
                  ) : null}
                </span>
                {list ? <Icon name="chevronRight" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * "Häufig genutzt" and the categories. One element on purpose: on desktop it is the first of the two
 * grid columns, so the two navigations must never become two grid children (the content would then
 * wrap into the narrow column).
 */
export function CategoryNav({ list }: { list?: boolean }) {
  const sections = useSettingsSections();
  const ids = visibleCategoryIds(sections);
  const overviewTitle = tSettings2.use().overview.title;
  const groupTitles = tSettingsV3.use().navGroups;
  const changed = useChangedCategories();
  const groups = NAV_GROUPS.map((g) => ({
    id: g.id,
    categories: g.categories.filter((c) => ids.includes(c)),
  })).filter((g) => g.categories.length > 0);
  return (
    <div className={list ? undefined : styles.aside} data-testid="settings-nav">
      <FrequentNav list={list} />
      <nav aria-label={t.settings.categoriesNav} className={list ? styles.listGroups : styles.nav}>
        {list ? null : (
          <ul>
            <li>
              <NavLink to="/settings" end className={styles.navLink} data-hue="slate">
                <span className={styles.icon}>
                  <Icon name="home" />
                </span>
                <span className={styles.linkText}>
                  <span className={styles.linkTitle}>{overviewTitle}</span>
                </span>
              </NavLink>
            </li>
          </ul>
        )}
        {groups.map((g) => (
          <div key={g.id} className={styles.navGroup}>
            <p className={styles.groupHead}>{groupTitles[g.id]}</p>
            <ul className={list ? styles.list : undefined}>
              {g.categories.map((id) => (
                <li key={id}>
                  <CategoryLink id={id} list={list} changed={changed.has(id)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}

/** `/settings`: the overview cards (and the category list on phones); old `#anchor` links are mapped. */
export function SettingsIndex() {
  const wide = useMediaQuery(MASTER_DETAIL_QUERY);
  const { hash } = useLocation();
  const legacy = legacyTarget(hash);
  if (legacy) return <Navigate to={legacy} replace />;
  return (
    <div className={styles.overview}>
      {wide ? null : <QuickBar />}
      <SettingsOverview />
      {wide ? null : <CategoryNav list />}
    </div>
  );
}

/** Scrolls to `#<section or section--field>` once the sections are rendered and highlights it briefly. */
/** How long a deep link keeps its target in view while sections above it load. */
const SETTLE_MS = 1500;

function useDeepLink(ready: boolean) {
  const { hash, pathname } = useLocation();
  const [focus] = useFocusSettings();
  const historyOn = focus.searchHistory;
  useEffect(() => {
    if (!ready || !hash) return;
    const id = decodeURIComponent(hash.slice(1));
    const sectionId = id.split('--')[0] ?? id;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let marked: HTMLElement | undefined;
    // Sections above the target load their code after the jump and push it down: scroll again while
    // the page settles, unless the person has scrolled themselves.
    let settle: ResizeObserver | undefined;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let touched = false;
    const touch = () => {
      touched = true;
    };
    const stopSettling = () => {
      settle?.disconnect();
      clearTimeout(settleTimer);
      for (const ev of ['wheel', 'touchstart', 'keydown'] as const)
        window.removeEventListener(ev, touch);
    };
    const keepInView = (target: HTMLElement) => {
      for (const ev of ['wheel', 'touchstart', 'keydown'] as const)
        window.addEventListener(ev, touch, { passive: true });
      settle = new ResizeObserver(() => {
        if (touched) return stopSettling();
        target.scrollIntoView({ block: 'start' });
      });
      // The page may scroll inside a container, so watch every ancestor of the target.
      for (let n: HTMLElement | null = target; n; n = n.parentElement) settle.observe(n);
      settleTimer = setTimeout(stopSettling, SETTLE_MS);
    };
    const apply = (): boolean => {
      // A setting without its own anchor (older sections) falls back to its section.
      const el = document.getElementById(id) ?? document.getElementById(sectionId);
      if (!el) return false;
      // A setting inside a folded "more settings" block opens it first, else there is nothing to scroll to.
      el.closest('details')?.setAttribute('open', '');
      el.scrollIntoView({ block: 'start' });
      keepInView(el);
      if (historyOn) recordSectionVisit(sectionId);
      // Section anchors sit on the heading: highlight the whole section.
      marked = el.matches('h1, h2') ? (el.closest('section') ?? el) : el;
      marked.dataset.highlight = 'true';
      timer = setTimeout(() => marked && delete marked.dataset.highlight, HIGHLIGHT_MS);
      return true;
    };
    // Some sections render only after their values are loaded (module settings): wait for them.
    let observer: MutationObserver | undefined;
    if (!document.getElementById(sectionId)) {
      observer = new MutationObserver(() => {
        if (document.getElementById(sectionId) && apply()) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      apply();
    }
    return () => {
      observer?.disconnect();
      stopSettling();
      clearTimeout(timer);
      if (marked) delete marked.dataset.highlight;
    };
  }, [ready, hash, pathname, historyOn]);
}

/** Does the section differ from its defaults? Re-checked when the look or the focus settings move. */
function useChanged(plan?: ResetPlan): boolean {
  const ui = useUiStore((st) => st);
  const [focus] = useFocusSettings();
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    if (!plan?.defaults) return;
    let live = true;
    void isChanged(plan).then((c) => live && setChanged(c));
    return () => {
      live = false;
    };
  }, [plan, ui, focus]);
  return plan?.defaults ? changed : false;
}

/** One section on a category page: maturity mark, scope line, the section, then the reset row (only when something differs). */
function SectionFrame({ s }: { s: SettingsSectionDef }) {
  const changed = useChanged(s.reset);
  const scope = scopeOf(s);
  const c = tSettings2.use().changed;
  return (
    <div className={styles.sectionFrame}>
      {s.maturity === 'preview' ? (
        <p className={styles.previewBadge} data-testid={`preview-${s.id}`}>
          <Badge>{t.settings.maturity.badge}</Badge>
        </p>
      ) : null}
      {scope ? <ScopeLabel scope={scope} /> : null}
      <Suspense fallback={null}>{s.render()}</Suspense>
      {s.reset && changed ? (
        <div className={styles.changedRow}>
          <Badge>{c.badge}</Badge>
          <Button
            variant="ghost"
            className={styles.reset}
            onClick={() => void resetSection(s.reset!, s.title)}
            data-testid={`reset-${s.id}`}
          >
            {tComfort.get().reset.button}: {s.title}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** The category's rarely needed sections behind one fold; its state is remembered per category on this device. */
function AdvancedFold({
  category,
  sections,
}: {
  category: SettingsCategoryId;
  sections: readonly SettingsSectionDef[];
}) {
  const o = tSettings2.use().advanced;
  const [comfort] = useComfortSettings();
  const open = advancedOpen(category, comfort.advancedAll);
  return (
    <details
      key={`${category}:${comfort.advancedAll}:${readAdvancedOpen(category)}`}
      className={styles.advanced}
      open={open}
      data-testid={`advanced-fold-${category}`}
    >
      <summary
        className={styles.advancedSummary}
        onClick={(e) => {
          const d = e.currentTarget.parentElement as HTMLDetailsElement;
          writeAdvancedOpen(category, !d.open);
        }}
      >
        <span>{o.title}</span>
        <span className={styles.advancedHint}>{o.hint(sections.length)}</span>
      </summary>
      <div className={styles.advancedBody}>
        {sections.map((s) => (
          <SectionFrame key={s.id} s={s} />
        ))}
      </div>
    </details>
  );
}

/** Crumbs for a category page: Einstellungen › Kategorie [› Abschnitt in view of the deep link]. */
function crumbsFor(category: SettingsCategoryId, sectionTitle?: string): Crumb[] {
  const root = tSettings2.get().nav.root;
  const title = categoryDef(category).title;
  return sectionTitle
    ? [
        { label: root, to: '/settings' },
        { label: title, to: `/settings/${category}` },
        { label: sectionTitle },
      ]
    : [{ label: root, to: '/settings' }, { label: title }];
}

export function CategoryPage() {
  const { category } = useParams();
  const wide = useMediaQuery(MASTER_DETAIL_QUERY);
  const { hash } = useLocation();
  const sections = useSettingsSections();
  const known = isCategoryId(category);
  const own = known ? sectionsOf(sections, category) : [];
  useDeepLink(own.length > 0);
  const [focus] = useFocusSettings();
  const counted = useRef(new Set<string>());
  /** Using a setting counts as a visit of its section, once per time the category is open. */
  const noteUse = (e: { target: EventTarget }) => {
    if (!focus.searchHistory || !(e.target instanceof Element)) return;
    const id = e.target.closest('section')?.querySelector('h2[id]')?.id;
    if (!id || counted.current.has(id)) return;
    counted.current.add(id);
    recordSectionVisit(id);
  };
  if (sections.length === 0) return <Skeleton />;
  if (!known || own.length === 0)
    return (
      <EmptyState compact title={t.settings.notFoundTitle}>
        <Link to="/settings">{t.settings.back}</Link>
      </EmptyState>
    );
  // Old links `/settings/module#module-<id>[--field]` arrive on the module's own page.
  const legacyModule =
    category === 'module' ? /^#module-([^-]+(?:-[^-]+)*?)(?:--(.+))?$/.exec(hash) : null;
  if (legacyModule && sections.some((x) => x.id === `module-${legacyModule[1]}`))
    return (
      <Navigate to={settingsPath('module', `module-${legacyModule[1]}`, legacyModule[2])} replace />
    );
  // A link to a section that lives in another category now (Lesehilfe, Fokus moved to Barrierefreiheit) follows it.
  const wanted = decodeURIComponent(hash.slice(1));
  const moved = sections.find((x) => x.id === wanted.split('--')[0] && x.category !== category);
  if (moved && !moduleIdOfSection(moved.category, moved.id)) {
    const field = wanted.split('--')[1];
    return <Navigate to={settingsPath(moved.category, moved.id, field)} replace />;
  }
  // A module's settings are a page of their own: the category shows the list instead.
  const shown = own.filter((x) => !moduleIdOfSection(category, x.id));
  const sectionId = decodeURIComponent(hash.slice(1)).split('--')[0];
  const current = shown.find((x) => x.id === sectionId)?.title;
  const basic = shown.filter((x) => levelOf(x) === 'basic');
  const advanced = shown.filter((x) => levelOf(x) === 'advanced');
  // Only a category with Basis sections folds the rest away; one that is all Erweitert shows it plainly.
  const fold = basic.length > 0 && advanced.length > 0;
  return (
    <div className={styles.category} onChange={noteUse} onClick={noteUse}>
      {wide ? (
        <Breadcrumb items={crumbsFor(category, current)} />
      ) : (
        <Link to="/settings" className={styles.back}>
          <Icon name="chevronLeft" />
          {t.settings.back}
        </Link>
      )}
      {basic.map((s) => (
        <SectionFrame key={s.id} s={s} />
      ))}
      {fold ? <AdvancedFold category={category} sections={advanced} /> : null}
      {fold ? null : advanced.map((s) => <SectionFrame key={s.id} s={s} />)}
      {category === 'module' ? <ModuleList /> : null}
    </div>
  );
}

/** `/settings/module/<id>`: breadcrumb or back link, then the module's own settings page. */
export function ModuleSettingsRoute() {
  const { moduleId } = useParams();
  const wide = useMediaQuery(MASTER_DETAIL_QUERY);
  const sections = useSettingsSections();
  const own = sections.find((x) => x.id === `module-${moduleId}`);
  useDeepLink(sections.length > 0);
  if (sections.length === 0) return <Skeleton />;
  const o = tSettings2.get();
  const crumbs: Crumb[] = [
    { label: o.nav.root, to: '/settings' },
    { label: categoryDef('module').title, to: '/settings/module' },
    { label: own?.title ?? moduleId ?? '' },
  ];
  return (
    <div className={styles.category}>
      {wide ? (
        <Breadcrumb items={crumbs} />
      ) : (
        <Link to="/settings/module" className={styles.back}>
          <Icon name="chevronLeft" />
          {o.modulePage.all}
        </Link>
      )}
      <ModuleSettingsPage />
    </div>
  );
}

/** Head of the open settings page: "Status" on the landing page, the category's own head on a category; a module page brings its own. */
function SettingsHead() {
  const { pathname } = useLocation();
  const v3 = tSettingsV3.use();
  const sections = useSettingsSections();
  if (/^\/settings\/module\/[^/]+/.test(pathname)) return null;
  const segment = /^\/settings\/([^/]+)/.exec(pathname)?.[1];
  if (!segment) return <StatusHead title={t.settings.title} />;
  // Sections still loading: no head yet (CategoryPage shows its skeleton), so no category head flashes up for a hidden one.
  if (sections.length === 0) return null;
  // An unknown category, or a known one without visible sections (vault off, preview hidden): a "not found" page, no category head.
  if (!isCategoryId(segment) || !visibleCategoryIds(sections).includes(segment))
    return (
      <PageHead
        {...STATUS_LOOK}
        icon="settings"
        eyebrow={v3.eyebrow}
        title={t.settings.title}
        testId="settings-head-missing"
      />
    );
  const c = categoryDef(segment);
  return (
    <PageHead
      {...CATEGORY_LOOK[segment]}
      icon={c.icon as IconName}
      eyebrow={v3.eyebrow}
      title={c.title}
      description={c.description}
      testId={`settings-head-${segment}`}
    />
  );
}

export function SettingsLayout() {
  const wide = useMediaQuery(MASTER_DETAIL_QUERY);
  const tocWide = useMediaQuery(TOC_QUERY);
  const open = useOpenCategory();
  const sections = useSettingsSections();
  const entries =
    open && open !== 'module'
      ? sectionsOf(sections, open).map((x) => ({ id: x.id, title: x.title }))
      : [];
  const showToc = wide && tocWide && entries.length >= 3;
  return (
    <>
      {wide ? <SettingsHead /> : null}
      <SettingsSearch />
      {wide ? null : <SettingsHead />}
      {wide ? <QuickBar /> : null}
      {wide ? (
        <div className={`${styles.split} ${showToc ? styles.splitToc : ''}`}>
          <CategoryNav />
          <div className={styles.content}>
            <Outlet />
          </div>
          {showToc ? <SettingsToc entries={entries} /> : null}
        </div>
      ) : (
        <Outlet />
      )}
    </>
  );
}
