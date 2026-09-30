import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { t } from '@/strings';
import {
  Button,
  Checkbox,
  Chip,
  Chips,
  EmptyState,
  Icon,
  ItemList,
  ItemRow,
  PageHeader,
  SelectField,
  Segmented,
  TextField,
  Toolbar,
} from '@/ui';
import { ItemEditor, type ItemTarget } from '../components/ItemEditor';
import { filterItems, hostOf, normalizeUrl, tagCounts, type Filter } from '../logic';
import { itemRepo } from '../repo';
import { KINDS, type Kind } from '../schema';

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
  const [target, setTarget] = useState<ItemTarget>(null);
  const [params, setParams] = useSearchParams();

  // `?new=1` (Quick-Add) or shared content (Web Share Target: title/text/url) opens the create dialog.
  const incoming = ['new', 'title', 'text', 'url'].some((k) => params.get(k));
  const openTarget = target ?? (incoming ? sharedDraft(params) : null);
  const closeEditor = () => {
    setTarget(null);
    if (incoming) setParams({}, { replace: true });
  };

  const shown = useMemo(() => filterItems(items ?? [], filter), [items, filter]);
  const tags = useMemo(() => tagCounts(items ?? []), [items]);

  return (
    <>
      <PageHeader title={t.bookmarks.title}>
        <Button variant="primary" onClick={() => setTarget({ draft: true })}>
          <Icon name="plus" size={18} />
          {t.bookmarks.add}
        </Button>
      </PageHeader>

      <Toolbar>
        <Segmented
          label={t.bookmarks.view}
          value={filter.view}
          options={(['open', 'done', 'all'] as const).map((v) => ({
            value: v,
            label: t.bookmarks.views[v],
          }))}
          onChange={(view) => setFilter({ ...filter, view })}
        />
        <SelectField
          label={t.bookmarks.kind}
          value={filter.kind}
          onChange={(e) => setFilter({ ...filter, kind: e.target.value as Kind | 'all' })}
        >
          <option value="all">{t.bookmarks.allKinds}</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {t.bookmarks.kinds[k]}
            </option>
          ))}
        </SelectField>
      </Toolbar>
      <TextField
        label={t.bookmarks.search}
        type="search"
        value={filter.query}
        onChange={(e) => setFilter({ ...filter, query: e.target.value })}
      />
      {tags.length > 0 ? (
        <div style={{ margin: 'var(--space-3) 0' }}>
          <Chips label={t.bookmarks.filterTags}>
            {tags.map(([tag, n]) => (
              <Chip
                key={tag}
                label={`${tag} (${n})`}
                selected={filter.tag?.toLowerCase() === tag.toLowerCase()}
                onClick={() =>
                  setFilter({
                    ...filter,
                    tag: filter.tag?.toLowerCase() === tag.toLowerCase() ? undefined : tag,
                  })
                }
              />
            ))}
          </Chips>
        </div>
      ) : null}

      {items && shown.length === 0 ? (
        <EmptyState
          icon="bookmark"
          title={items.length === 0 ? t.bookmarks.empty : t.bookmarks.emptyFiltered}
        />
      ) : null}
      <ItemList layout="grid" label={t.bookmarks.title}>
        {shown.map((i) => (
          <ItemRow
            key={i.id}
            title={i.title}
            onOpen={() => setTarget(i)}
            lead={
              <Checkbox
                aria-label={`${t.bookmarks.done}: ${i.title}`}
                label=""
                checked={i.done}
                onChange={(e) => void itemRepo.update(i.id, { done: e.target.checked })}
              />
            }
            meta={[t.bookmarks.kinds[i.kind], hostOf(i.url), ...i.tags.map((x) => `#${x}`)]
              .filter(Boolean)
              .join(' · ')}
            end={
              i.url ? (
                <a
                  href={i.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${t.bookmarks.open}: ${i.title}`}
                  style={{ display: 'grid', placeItems: 'center', minWidth: 44, minHeight: 44 }}
                >
                  <Icon name="external" />
                </a>
              ) : undefined
            }
          />
        ))}
      </ItemList>

      <ItemEditor target={openTarget} onClose={closeEditor} />
    </>
  );
}
