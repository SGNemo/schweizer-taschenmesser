import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useMatch,
  useNavigate,
  useParams,
} from 'react-router';
import { categoryDef, SETTINGS_CATEGORIES } from '@/core/settings/registry/categories';
import { legacyTarget, settingsPath } from '@/core/settings/registry/paths';
import { sectionsOf, visibleCategoryIds } from '@/core/settings/registry/registry';
import { searchSettings } from '@/core/settings/registry/search';
import { isCategoryId, type SettingsCategoryId } from '@/core/settings/registry/types';
import { t } from '@/strings';
import { EmptyState, Icon, Skeleton, TextField, useMediaQuery, type IconName } from '@/ui';
import { CategoryStatus } from './CategoryStatus';
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
    <div role="search" className={styles.search}>
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

function CategoryNav({ list }: { list?: boolean }) {
  const sections = useSettingsSections();
  const ids = visibleCategoryIds(sections);
  return (
    <nav aria-label={t.settings.categoriesNav} className={list ? styles.list : styles.nav}>
      <ul>
        {ids.map((id) => (
          <li key={id}>
            <CategoryLink id={id} list={list} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** `/settings`: redirect to the first category on desktop, the category list on phones; old `#anchor` links are mapped. */
export function SettingsIndex() {
  const wide = useMediaQuery(MASTER_DETAIL_QUERY);
  const { hash } = useLocation();
  const legacy = legacyTarget(hash);
  if (legacy) return <Navigate to={legacy} replace />;
  if (wide) return <Navigate to={settingsPath('allgemein')} replace />;
  return <CategoryNav list />;
}

/** Scrolls to `#<section or section--field>` once the sections are rendered and highlights it briefly. */
function useDeepLink(ready: boolean) {
  const { hash, pathname } = useLocation();
  useEffect(() => {
    if (!ready || !hash) return;
    const id = decodeURIComponent(hash.slice(1));
    // A setting without its own anchor (older sections) falls back to its section.
    const el = document.getElementById(id) ?? document.getElementById(id.split('--')[0] ?? id);
    if (!el) return;
    el.scrollIntoView({ block: 'start' });
    // Section anchors sit on the heading: highlight the whole section.
    const target = el.matches('h2') ? (el.closest('section') ?? el) : el;
    target.dataset.highlight = 'true';
    const timer = setTimeout(() => delete target.dataset.highlight, HIGHLIGHT_MS);
    return () => {
      clearTimeout(timer);
      delete target.dataset.highlight;
    };
  }, [ready, hash, pathname]);
}

export function CategoryPage() {
  const { category } = useParams();
  const wide = useMediaQuery(MASTER_DETAIL_QUERY);
  const sections = useSettingsSections();
  const known = isCategoryId(category);
  const own = known ? sectionsOf(sections, category) : [];
  useDeepLink(own.length > 0);
  if (sections.length === 0) return <Skeleton />;
  if (!known || own.length === 0)
    return (
      <EmptyState compact title={t.settings.notFoundTitle}>
        <Link to="/settings">{t.settings.back}</Link>
      </EmptyState>
    );
  return (
    <div className={styles.category}>
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
        <Fragment key={s.id}>{s.render()}</Fragment>
      ))}
    </div>
  );
}

export function SettingsLayout() {
  const wide = useMediaQuery(MASTER_DETAIL_QUERY);
  const inCategory = useMatch('/settings/:category/*') !== null;
  return (
    <>
      <div className={styles.header}>
        <h1>{t.settings.title}</h1>
      </div>
      {wide || !inCategory ? <SettingsSearch /> : null}
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
