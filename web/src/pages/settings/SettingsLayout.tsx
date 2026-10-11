import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router';
import { useFocusSettings } from '@/core/settings/focus';
import { frequentSections, recordSectionVisit } from '@/core/settings/frequent';
import { resetSection } from '@/core/settings/reset';
import { categoryDef, SETTINGS_CATEGORIES } from '@/core/settings/registry/categories';
import { legacyTarget, settingsPath } from '@/core/settings/registry/paths';
import { sectionsOf, visibleCategoryIds } from '@/core/settings/registry/registry';
import { searchSettings } from '@/core/settings/registry/search';
import { isCategoryId, type SettingsCategoryId } from '@/core/settings/registry/types';
import { t } from '@/strings';
import { tComfort } from '@/strings.comfort';
import { Button, EmptyState, Icon, Skeleton, TextField, useMediaQuery, type IconName } from '@/ui';
import { CategoryStatus } from './CategoryStatus';
import { QuickBar } from './QuickBar';
import { useSettingsSections } from './useSections';
import styles from './SettingsLayout.module.css';

/** Desktop two-column layout from this width; below it the categories are a list (first level). */
const MASTER_DETAIL_QUERY = '(min-width: 900px)';
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
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function CategoryLink({ id, list }: { id: SettingsCategoryId; list?: boolean }) {
  const c = categoryDef(id);
  return (
    <NavLink to={`/settings/${id}`} className={list ? styles.listLink : styles.navLink}>
      <span className={styles.icon}>
        <Icon name={c.icon as IconName} />
      </span>
      <span className={styles.linkText}>
        <span className={styles.linkTitle}>{c.title}</span>
        {list ? <span className={styles.linkDesc}>{c.description}</span> : null}
      </span>
      <CategoryStatus id={id} />
      {list ? <Icon name="chevronRight" /> : null}
    </NavLink>
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

function CategoryNav({ list }: { list?: boolean }) {
  const sections = useSettingsSections();
  const ids = visibleCategoryIds(sections);
  return (
    <>
      <FrequentNav list={list} />
      <nav aria-label={t.settings.categoriesNav} className={list ? styles.list : styles.nav}>
        <ul>
          {ids.map((id) => (
            <li key={id}>
              <CategoryLink id={id} list={list} />
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

/** `/settings`: redirect to the first category on desktop, the category list on phones; old `#anchor` links are mapped. */
export function SettingsIndex() {
  const wide = useMediaQuery(MASTER_DETAIL_QUERY);
  const { hash } = useLocation();
  const legacy = legacyTarget(hash);
  if (legacy) return <Navigate to={legacy} replace />;
  if (wide) return <Navigate to={settingsPath('allgemein')} replace />;
  return (
    <>
      <QuickBar />
      <CategoryNav list />
    </>
  );
}

/** Scrolls to `#<section or section--field>` once the sections are rendered and highlights it briefly. */
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
    const apply = (): boolean => {
      // A setting without its own anchor (older sections) falls back to its section.
      const el = document.getElementById(id) ?? document.getElementById(sectionId);
      if (!el) return false;
      el.scrollIntoView({ block: 'start' });
      if (historyOn) recordSectionVisit(sectionId);
      // Section anchors sit on the heading: highlight the whole section.
      marked = el.matches('h2') ? (el.closest('section') ?? el) : el;
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
      clearTimeout(timer);
      if (marked) delete marked.dataset.highlight;
    };
  }, [ready, hash, pathname, historyOn]);
}

export function CategoryPage() {
  const { category } = useParams();
  const wide = useMediaQuery(MASTER_DETAIL_QUERY);
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
  return (
    <div className={styles.category} onChange={noteUse} onClick={noteUse}>
      {wide ? null : (
        <Link to="/settings" className={styles.back}>
          <Icon name="chevronLeft" />
          {t.settings.back}
        </Link>
      )}
      {wide ? null : (
        <p aria-hidden="true" className={styles.categoryTitle}>
          {categoryDef(category).title}
        </p>
      )}
      {own.map((s) => (
        <Fragment key={s.id}>
          {s.render()}
          {s.reset ? (
            <Button
              variant="ghost"
              className={styles.reset}
              onClick={() => void resetSection(s.reset!, s.title)}
              data-testid={`reset-${s.id}`}
            >
              {tComfort.get().reset.button}: {s.title}
            </Button>
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}

export function SettingsLayout() {
  const wide = useMediaQuery(MASTER_DETAIL_QUERY);
  return (
    <>
      <div className={styles.header}>
        <h1>{t.settings.title}</h1>
      </div>
      <SettingsSearch />
      {wide ? <QuickBar /> : null}
      {wide ? (
        <div className={styles.split}>
          <CategoryNav />
          <div className={styles.content}>
            <Outlet />
          </div>
        </div>
      ) : (
        <Outlet />
      )}
    </>
  );
}
