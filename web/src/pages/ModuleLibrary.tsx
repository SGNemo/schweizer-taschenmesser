import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useModuleStates } from '@/core/modules/activation';
import { availableManifests, useCatalogManifests } from '@/core/modules/available';
import { libraryBadges, markLibrarySeen } from '@/core/modules/librarySeen';
import { normalize } from '@/core/text/normalize';
import { hasStartData } from '@/core/dataapi/onboarding';
import { StartDataButton } from '@/core/importer/StartDataButton';
import { AREAS, type AreaId, type ModuleManifest } from '@/core/modules/types';
import { SetupLink } from '@/layout/setup/SetupLink';
import { t } from '@/strings';
import { tComfort } from '@/strings.comfort';
import { tLibraryV3 } from '@/strings.libraryV3';
import {
  Badge,
  LibraryCard,
  SelectField,
  Segmented,
  Switch,
  TextField,
  Toolbar,
  useHashTarget,
} from '@/ui';
import { PageHead } from './settings/PageHead';
import { useModuleSwitch } from './library/useModuleSwitch';
import { WidgetMiniature } from './library/WidgetMiniature';
import library from './library/Library.module.css';
import styles from './Page.module.css';

type Filter = 'all' | 'active' | 'off' | 'news';
type AreaFilter = AreaId | 'other' | 'all';

interface LibraryGroup {
  id: string;
  area: AreaId | undefined;
  label: string;
  manifests: ModuleManifest[];
}

/** What a search matches: name, description and the settings words of the module. */
const haystack = (m: ModuleManifest) =>
  normalize([m.name, m.description, ...(m.settings.keywords ?? [])].join(' '));

/** The available modules grouped by navigation area (same order and names as the sidebar); modules without an area come last. */
function libraryGroups(catalog: readonly ModuleManifest[]): LibraryGroup[] {
  const groups: LibraryGroup[] = AREAS.map((id) => ({
    id,
    area: id,
    label: t.nav.areas[id],
    manifests: catalog.filter((m) => m.area === id),
  }));
  groups.push({
    id: 'other',
    area: undefined,
    label: t.library.other,
    manifests: catalog.filter((m) => !m.area),
  });
  return groups.filter((g) => g.manifests.length > 0);
}

export function ModuleLibrary() {
  const states = useModuleStates();
  // Preview modules only with "In Arbeit anzeigen" or when already on (core/modules/available.ts).
  const catalog = useCatalogManifests(states);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [areaFilter, setAreaFilter] = useState<AreaFilter>('all');
  const sw = useModuleSwitch();
  const text = tComfort.get().library;
  const v3 = tLibraryV3.use();
  // The marks shown now; the library counts as looked at when it is left.
  const badges = useMemo(() => libraryBadges(availableManifests()), []);
  useEffect(() => () => markLibrarySeen(availableManifests()), []);
  // `/library#module-<id>` (from the palette or a link) scrolls to that card and marks it.
  useHashTarget(states !== undefined);

  const isOn = (m: ModuleManifest) => states?.[m.id] ?? false;
  const activeCount = catalog.filter(isOn).length;
  const newsCount = catalog.filter((m) => badges[m.id]).length;

  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  const shown = catalog.filter((m) => {
    const text = haystack(m);
    if (!tokens.every((tok) => text.includes(tok))) return false;
    if (filter === 'active' && !isOn(m)) return false;
    if (filter === 'off' && isOn(m)) return false;
    if (filter === 'news' && !badges[m.id]) return false;
    return true;
  });
  const allGroups = libraryGroups(catalog);
  const groups = libraryGroups(shown).filter((g) => areaFilter === 'all' || g.id === areaFilter);

  return (
    <>
      <PageHead
        hue="cobalt"
        area="system"
        icon="grid"
        eyebrow={v3.eyebrow}
        title={t.library.title}
        description={t.library.intro}
        size="tall"
        testId="library-head"
        actions={<SetupLink />}
      >
        <ul className={library.figures} aria-label={v3.figures.label} data-testid="library-figures">
          <li>
            <strong>{activeCount}</strong> {v3.figures.active}
          </li>
          <li>
            <strong>{catalog.length}</strong> {v3.figures.available}
          </li>
          {newsCount > 0 ? (
            <li>
              <strong>{newsCount}</strong> {v3.figures.news}
            </li>
          ) : null}
        </ul>
      </PageHead>
      <Toolbar>
        <div role="search" className={styles.librarySearch}>
          <TextField
            label={text.search}
            labelHidden
            type="search"
            placeholder={text.searchPlaceholder}
            value={query}
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Segmented
          label={v3.filter.label}
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: v3.filter.all },
            { value: 'active', label: v3.filter.active },
            { value: 'off', label: v3.filter.off },
            ...(newsCount > 0 ? [{ value: 'news' as const, label: v3.filter.news }] : []),
          ]}
        />
        <SelectField
          label={v3.filter.areaLabel}
          labelHidden
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value as AreaFilter)}
        >
          <option value="all">{v3.filter.allAreas}</option>
          {allGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </SelectField>
      </Toolbar>
      {groups.length === 0 ? (
        <p role="status" className={styles.lead}>
          {text.noResults}
        </p>
      ) : null}
      {groups.map((g) => {
        const total = allGroups.find((x) => x.id === g.id)?.manifests ?? g.manifests;
        return (
          <section
            key={g.id}
            className={library.group}
            data-area={g.area}
            aria-labelledby={`lib-${g.id}`}
          >
            <h2 id={`lib-${g.id}`} className={library.groupHead}>
              {g.label}
              <span className={library.groupCount}>
                {v3.section(total.filter(isOn).length, total.length)}
              </span>
            </h2>
            <ul className={library.cards}>
              {g.manifests.map((m) => {
                const enabled = isOn(m);
                return (
                  <LibraryCard
                    key={m.id}
                    id={`module-${m.id}`}
                    testId={`module-${m.id}`}
                    icon={m.icon}
                    name={m.name}
                    description={m.description}
                    hue={m.identity.hue}
                    preview={<WidgetMiniature variant={m.identity.widget} />}
                    badges={
                      <>
                        {enabled ? <Badge tone="accent">{t.library.active}</Badge> : null}
                        {badges[m.id] ? (
                          <Badge>
                            {badges[m.id] === 'new' ? text.badgeNew : text.badgeUpdated}
                          </Badge>
                        ) : null}
                        {m.devOnly ? <Badge>{t.library.devOnly}</Badge> : null}
                        {m.maturity === 'preview' ? (
                          <Badge>{t.settings.maturity.badge}</Badge>
                        ) : null}
                      </>
                    }
                  >
                    <Link
                      to={`/library/${m.id}`}
                      className={library.details}
                      aria-label={v3.detailsOf(m.name)}
                    >
                      {v3.details}
                    </Link>
                    {enabled && hasStartData(m) ? (
                      <StartDataButton moduleId={m.id} setupLink={false} />
                    ) : null}
                    <Switch
                      label={text.toggle(m.name)}
                      checked={enabled}
                      disabled={!states}
                      onChange={(on) => sw.set(m, on)}
                    />
                  </LibraryCard>
                );
              })}
            </ul>
          </section>
        );
      })}
      {sw.node}
    </>
  );
}
