import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { getPlatform } from '@/core/platform';
import { useAdvanced } from '@/core/settings/comfort';
import { useSettings } from '@/core/settings/settings';
import { today } from '@/core/time/now';
import { t } from '@/strings';
import { tAdvanced } from '@/strings.advanced';
import {
  Button,
  EmptyState,
  GroupedList,
  Icon,
  ItemList,
  ItemRow,
  PageAction,
  PageHeader,
  RowMenu,
  Tabs,
  TextField,
  useOpenParam,
  type RowMenuItem,
} from '@/ui';
import { BookmarkCard } from '../components/BookmarkCard';
import { BookmarkRow, bookmarkMenu } from '../components/BookmarkRow';
import { ItemEditor, type ItemTarget } from '../components/ItemEditor';
import {
  filterItems,
  groupItems,
  groupLinks,
  GROUPINGS,
  hostOf,
  normalizeUrl,
  tagCounts,
  type Filter,
  type Grouping,
} from '../logic';
import { itemRepo } from '../repo';
import {
  type BookmarksSettings,
  settings as moduleSettings,
  settingsSchema,
  SORTS,
  type SortMode,
} from '../settings';
import { KINDS } from '../schema';
import { HeroFigure, HeroSlot, SignatureMark } from '@/ui/identity';
import { useStartDataItems } from '@/core/importer/StartDataMenu';
import styles from './bookmarks.module.css';

/** The Web Share Target sends `title`, `text` and `url`; some apps put the link into `text`. */
function sharedDraft(params: URLSearchParams): { draft: true; title?: string; url?: string } {
  const text = params.get('text') ?? '';
  const url = params.get('url') || text.match(/https?:\/\/\S+/)?.[0];
  const title = params.get('title') || text.replace(/https?:\/\/\S+/, '').trim();
  return {
    draft: true,
    title: title || undefined,
    url: url && normalizeUrl(url) ? url : undefined,
  };
}

export default function BookmarksPage() {
  const items = useLiveQuery(() => itemRepo.active().toArray(), []);
  const [stored, setPrefs] = useSettings(
    'module.bookmarks',
    settingsSchema,
    moduleSettings.defaults as never,
  );
  const prefs = stored ?? (moduleSettings.defaults as BookmarksSettings);
  const navigate = useNavigate();
  const read = (i: { id: string }) => void navigate(`/bookmarks/read/${i.id}`);
  const [filter, setFilter] = useState<Filter>({ view: 'open', kind: 'all', query: '' });
  const [grouping, setGrouping] = useState<Grouping>('recent');
  const [menuOpen, setMenuOpen] = useState(false);
  const [advanced, setAdvanced] = useAdvanced('bookmarks');
  const tx = tAdvanced.use();
  const [target, setTarget] = useState<ItemTarget>(null);
  useOpenParam((id) => itemRepo.get(id), setTarget);
  const [params, setParams] = useSearchParams();

  // `?new=1` (Quick-Add) or shared content (Web Share Target: title/text/url) opens the create dialog.
  const incoming = ['new', 'title', 'text', 'url'].some((k) => params.get(k));
  const openTarget = target ?? (incoming ? sharedDraft(params) : null);
  const closeEditor = () => {
    setTarget(null);
    if (incoming) setParams({}, { replace: true });
  };

  const linksView = params.get('view') === 'links';
  const shown = useMemo(
    () => filterItems(items ?? [], filter, prefs.sort),
    [items, filter, prefs.sort],
  );
  const tags = useMemo(() => tagCounts(items ?? []), [items]);
  const openItems = useMemo(() => (items ?? []).filter((i) => !i.done), [items]);
  // Head context line: the biggest kinds among the open entries ("3 Lesen · 2 Ansehen").
  const kindLine = useMemo(() => {
    const n = new Map<string, number>();
    for (const i of openItems) n.set(i.kind, (n.get(i.kind) ?? 0) + 1);
    return [...n.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, c]) => `${c} ${t.bookmarks.kinds[k] ?? k}`)
      .join(' · ');
  }, [openItems]);
  // "Lesezeichen": links as tiles, the first tag is the group (the former "Apps & Links").
  const links = useMemo(
    () =>
      groupLinks(
        filterItems(
          (items ?? []).filter((i) => i.kind === 'link'),
          { view: 'all', kind: 'all', query: filter.query },
        ),
      ),
    [items, filter.query],
  );
  const groups = useMemo(
    () =>
      groupItems(shown, grouping, today(), prefs.sort).map((g) => ({
        id: g.id,
        label:
          grouping === 'recent'
            ? t.bookmarks.recent[g.id as keyof typeof t.bookmarks.recent]
            : grouping === 'kind'
              ? t.bookmarks.kinds[g.id]!
              : g.tag || t.bookmarks.noGroup,
        count: g.items.length,
        children:
          prefs.view === 'cards' ? (
            <div className={styles.cards}>
              {g.items.map((i) => (
                <BookmarkCard
                  key={i.id}
                  item={i}
                  onEdit={setTarget}
                  onFilterTag={filterTag}
                  onRead={read}
                />
              ))}
            </div>
          ) : (
            <ItemList>
              {g.items.map((i) => (
                <BookmarkRow
                  key={i.id}
                  item={i}
                  onEdit={setTarget}
                  onFilterTag={filterTag}
                  onRead={read}
                />
              ))}
            </ItemList>
          ),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shown, grouping, prefs.view, prefs.sort],
  );
  const sameTag = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
  function filterTag(tag: string) {
    setFilter((f) => ({ ...f, tag: sameTag(f.tag, tag) ? undefined : tag }));
  }
  const setView = (view: 'list' | 'links') => {
    const next = new URLSearchParams(params);
    if (view === 'links') next.set('view', 'links');
    else next.delete('view');
    setParams(next, { replace: true });
  };

  const listMenu: RowMenuItem[] = [
    ...(['list', 'cards'] as const).map((v) => ({
      id: `layout-${v}`,
      group: t.bookmarks.tabsLabel,
      label: v === 'list' ? t.bookmarks.viewList : t.bookmarks.viewCards,
      checked: prefs.view === v,
      onSelect: () => void setPrefs({ view: v }),
    })),
    ...(['open', 'done', 'all'] as const).map((v) => ({
      id: `view-${v}`,
      group: t.bookmarks.view,
      label: t.bookmarks.views[v],
      checked: filter.view === v,
      onSelect: () => setFilter({ ...filter, view: v }),
    })),
    ...(['all', ...KINDS] as const).map((k) => ({
      id: `kind-${k}`,
      group: t.bookmarks.kind,
      label: k === 'all' ? t.bookmarks.allKinds : t.bookmarks.kinds[k]!,
      checked: filter.kind === k,
      onSelect: () => setFilter({ ...filter, kind: k }),
    })),
    ...tags.map(([tag, n]) => ({
      id: `tag-${tag}`,
      group: t.bookmarks.filterTags,
      label: `${tag} (${n})`,
      checked: sameTag(filter.tag, tag),
      onSelect: () => filterTag(tag),
    })),
    ...SORTS.map((m) => ({
      id: `sort-${m}`,
      group: t.bookmarks.sortBy,
      label: t.bookmarks.sorts[m],
      checked: prefs.sort === m,
      onSelect: () => void setPrefs({ sort: m satisfies SortMode }),
    })),
    ...GROUPINGS.map((g) => ({
      id: `group-${g}`,
      group: t.bookmarks.groupBy,
      label: t.bookmarks.groupings[g],
      checked: grouping === g,
      onSelect: () => setGrouping(g),
    })),
  ];
  const startItems = useStartDataItems('bookmarks');
  const pageMenu: RowMenuItem[] = [
    ...(linksView ? [] : listMenu),
    {
      id: 'advanced',
      group: t.bookmarks.moreOptions,
      label: tx.switchLabel,
      checked: advanced,
      onSelect: () => setAdvanced(!advanced),
    },
    ...startItems.map((i) => ({ ...i, group: t.bookmarks.moreOptions })),
  ];
  // Nothing saved yet: the empty state holds the one filled button, the head's action steps back.
  const isEmpty = !!items && (linksView ? links.length === 0 && !filter.query : items.length === 0);
  const activeFilters = [
    filter.view !== 'open' ? t.bookmarks.views[filter.view] : '',
    filter.kind !== 'all' ? t.bookmarks.kinds[filter.kind]! : '',
    filter.tag ? `#${filter.tag}` : '',
  ].filter(Boolean);

  return (
    <>
      {items && items.length > 0 ? (
        <HeroSlot area="figure">
          <HeroFigure
            label={t.bookmarks.title}
            value={String(openItems.length)}
            unit={t.bookmarks.figureUnit(openItems.length)}
            detail={kindLine || undefined}
            testId="bookmarks-open"
          />
        </HeroSlot>
      ) : null}
      <PageHeader
        title={t.bookmarks.title}
        besideContent
        views={
          <Tabs
            label={t.bookmarks.tabsLabel}
            value={linksView ? 'links' : 'list'}
            options={[
              { value: 'list', label: t.bookmarks.tabList },
              { value: 'links', label: t.bookmarks.tabLinks },
            ]}
            onChange={(id) => setView(id === 'links' ? 'links' : 'list')}
          />
        }
      >
        <PageAction
          short={linksView ? t.nav.plusThings.link : t.bookmarks.meta.quickAdd}
          variant={isEmpty ? 'secondary' : 'primary'}
          onClick={() => setTarget(linksView ? { draft: true, kind: 'link' } : { draft: true })}
        >
          <Icon name="plus" size={18} />
          {linksView ? t.bookmarks.addLink : t.bookmarks.add}
        </PageAction>
        <RowMenu
          label={t.bookmarks.moreOptions}
          open={menuOpen}
          onOpenChange={setMenuOpen}
          items={pageMenu}
        />
      </PageHeader>
      {/* The page's first row: on the phone the "⋯" menu lies beside it (`besideContent`). An empty page has nothing
          to search; its row is the menu alone. */}
      <div className={styles.search}>
        {isEmpty ? null : (
          <TextField
            label={t.bookmarks.search}
            labelHidden
            placeholder={t.bookmarks.search}
            type="search"
            data-list-search
            value={filter.query}
            onChange={(e) => setFilter({ ...filter, query: e.target.value })}
          />
        )}
      </div>
      {!linksView && activeFilters.length > 0 ? (
        <p className={styles.note} data-testid="bookmarks-filter">
          {t.bookmarks.showing(activeFilters.join(' · '))}
          <Button
            variant="ghost"
            onClick={() => setFilter({ ...filter, view: 'open', kind: 'all', tag: undefined })}
          >
            {t.bookmarks.showAll}
          </Button>
        </p>
      ) : null}

      {linksView ? (
        <>
          {items && links.length === 0 ? (
            <EmptyState
              title={t.bookmarks.linksEmpty}
              testId="bookmarks-empty"
              motif={<SignatureMark id="pinboard" size={64} />}
            >
              {filter.query ? null : (
                <Button variant="primary" onClick={() => setTarget({ draft: true, kind: 'link' })}>
                  {t.bookmarks.addLink}
                </Button>
              )}
            </EmptyState>
          ) : null}
          {links.map(([group, list]) => (
            <section key={group || '-'} aria-label={group || t.bookmarks.noGroup}>
              <h2>{group || t.bookmarks.noGroup}</h2>
              <ItemList layout="grid" label={group || t.bookmarks.noGroup}>
                {list.map((i) => (
                  <ItemRow
                    key={i.id}
                    title={i.title}
                    meta={hostOf(i.url)}
                    onOpen={
                      i.url ? () => void getPlatform().app.openUrl(i.url!) : () => setTarget(i)
                    }
                    menu={bookmarkMenu(i, { edit: setTarget, read })}
                  />
                ))}
              </ItemList>
            </section>
          ))}
        </>
      ) : null}
      {linksView ? null : items && shown.length === 0 ? (
        <EmptyState
          title={items.length === 0 ? t.bookmarks.empty : t.bookmarks.emptyFiltered}
          testId="bookmarks-empty"
          motif={<SignatureMark id="pinboard" size={64} />}
        >
          {items.length === 0 ? (
            <Button variant="primary" onClick={() => setTarget({ draft: true })}>
              {t.bookmarks.emptyAction}
            </Button>
          ) : null}
        </EmptyState>
      ) : null}
      {linksView || shown.length === 0 ? null : (
        <GroupedList listId={`bookmarks-${grouping}`} groups={groups} label={t.bookmarks.title} />
      )}

      <ItemEditor target={openTarget} onClose={closeEditor} />
    </>
  );
}
