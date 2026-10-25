import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { getPlatform } from '@/core/platform';
import { useAdvanced } from '@/core/settings/comfort';
import { today } from '@/core/time/now';
import { t } from '@/strings';
import { tAdvanced } from '@/strings.advanced';
import {
  Button,
  EmptyState,
  GroupedList,
  Icon,
  IconButton,
  ItemList,
  ItemRow,
  PageHeader,
  RowMenu,
  Segmented,
  TextField,
  useOpenParam,
  type RowMenuItem,
} from '@/ui';
import { BookmarkRow } from '../components/BookmarkRow';
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
import { KINDS } from '../schema';
import { StartDataButton } from '@/core/importer/StartDataButton';
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
  const shown = useMemo(() => filterItems(items ?? [], filter), [items, filter]);
  const tags = useMemo(() => tagCounts(items ?? []), [items]);
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
      groupItems(shown, grouping, today()).map((g) => ({
        id: g.id,
        label:
          grouping === 'recent'
            ? t.bookmarks.recent[g.id as keyof typeof t.bookmarks.recent]
            : grouping === 'kind'
              ? t.bookmarks.kinds[g.id]!
              : g.tag || t.bookmarks.noGroup,
        count: g.items.length,
        children: (
          <ItemList>
            {g.items.map((i) => (
              <BookmarkRow key={i.id} item={i} onEdit={setTarget} onFilterTag={filterTag} />
            ))}
          </ItemList>
        ),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shown, grouping],
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
    ...GROUPINGS.map((g) => ({
      id: `group-${g}`,
      group: t.bookmarks.groupBy,
      label: t.bookmarks.groupings[g],
      checked: grouping === g,
      onSelect: () => setGrouping(g),
    })),
  ];
  const pageMenu: RowMenuItem[] = [
    ...(linksView ? [] : listMenu),
    {
      id: 'advanced',
      group: t.bookmarks.moreOptions,
      label: tx.switchLabel,
      checked: advanced,
      onSelect: () => setAdvanced(!advanced),
    },
  ];
  const activeFilters = [
    filter.view !== 'open' ? t.bookmarks.views[filter.view] : '',
    filter.kind !== 'all' ? t.bookmarks.kinds[filter.kind]! : '',
    filter.tag ? `#${filter.tag}` : '',
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        title={t.bookmarks.title}
        views={
          <Segmented
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
        <Button
          variant="primary"
          onClick={() => setTarget(linksView ? { draft: true, kind: 'link' } : { draft: true })}
        >
          <Icon name="plus" size={18} />
          {linksView ? t.bookmarks.addLink : t.bookmarks.add}
        </Button>
        <RowMenu
          label={t.bookmarks.moreOptions}
          open={menuOpen}
          onOpenChange={setMenuOpen}
          items={pageMenu}
        />
      </PageHeader>
      <TextField
        label={t.bookmarks.search}
        type="search"
        value={filter.query}
        onChange={(e) => setFilter({ ...filter, query: e.target.value })}
      />
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
            <EmptyState title={t.bookmarks.linksEmpty}>
              <StartDataButton moduleId="bookmarks" />
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
                    actions={
                      <IconButton
                        label={`${t.bookmarks.edit}: ${i.title}`}
                        onClick={() => setTarget(i)}
                      >
                        <Icon name="edit" />
                      </IconButton>
                    }
                  />
                ))}
              </ItemList>
            </section>
          ))}
        </>
      ) : null}
      {linksView ? null : items && shown.length === 0 ? (
        <EmptyState title={items.length === 0 ? t.bookmarks.empty : t.bookmarks.emptyFiltered}>
          {items.length === 0 ? <StartDataButton moduleId="bookmarks" /> : null}
        </EmptyState>
      ) : null}
      {linksView || shown.length === 0 ? null : (
        <GroupedList listId={`bookmarks-${grouping}`} groups={groups} label={t.bookmarks.title} />
      )}

      <ItemEditor target={openTarget} onClose={closeEditor} />
    </>
  );
}
