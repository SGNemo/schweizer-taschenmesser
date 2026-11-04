import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { collator } from '@/core/i18n/format';
import { useSettings } from '@/core/settings/settings';
import { deleteWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import {
  Button,
  Dialog,
  EmptyState,
  GroupedList,
  Icon,
  ItemRow,
  PageHeader,
  TextField,
  useOpenParam,
} from '@/ui';
import { feedKey, groupFeeds, hostOf, normalizeFeedUrl } from '../logic';
import { feedRepo } from '../repo';
import { settings, type FeedsSettings } from '../settings';

interface Draft {
  id?: string;
  title: string;
  url: string;
  category: string;
}

const EMPTY: Draft = { title: '', url: '', category: '' };

export default function MainPage() {
  const s = t.feeds;
  const feeds = useLiveQuery(() => feedRepo.active().toArray(), []);
  const [edited, setDraft] = useState<Draft | null>(null);
  const [closed, setClosed] = useState(false);
  const [error, setError] = useState('');
  const [params, setParams] = useSearchParams();
  const [prefs] = useSettings('module.feeds', settings.schema, settings.defaults);

  // `?new=1` (quick add, widget) opens the empty form; typing takes the draft over.
  const wantsNew = params.get('new') !== null && !closed;
  const draft = edited ?? (wantsNew ? EMPTY : null);
  useOpenParam(
    (id) => feedRepo.get(id),
    (feed) => setDraft({ id: feed.id, title: feed.title, url: feed.url, category: feed.category }),
  );

  const grouped = ((prefs ?? settings.defaults) as FeedsSettings).grouped;
  const groups = groupFeeds(
    (feeds ?? []).map((f) => (grouped ? f : { ...f, category: '' })),
    collator(),
  );
  const categories = [...new Set((feeds ?? []).map((f) => f.category).filter(Boolean))];

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const url = normalizeFeedUrl(draft.url);
    if (!url) return setError(s.errors.url);
    const others = (feeds ?? []).filter((f) => f.id !== draft.id);
    if (others.some((f) => feedKey(f.url) === feedKey(url))) return setError(s.errors.duplicate);
    const data = {
      title: draft.title.trim() || hostOf(url),
      url,
      category: draft.category.trim(),
    };
    if (draft.id) await feedRepo.update(draft.id, data);
    else await feedRepo.create(data);
    close();
  }

  function close() {
    setDraft(null);
    setClosed(true);
    setError('');
    if (params.get('new') !== null) setParams({}, { replace: true });
  }

  return (
    <>
      <PageHeader title={s.title}>
        <Button variant="primary" onClick={() => setDraft(EMPTY)}>
          <Icon name="plus" size={18} />
          {s.add}
        </Button>
      </PageHeader>
      {feeds && feeds.length === 0 ? (
        <EmptyState title={s.empty}>
          <p>{s.emptyHint}</p>
          <Button variant="primary" onClick={() => setDraft(EMPTY)}>
            {s.add}
          </Button>
        </EmptyState>
      ) : null}
      {groups.length > 0 ? (
        <GroupedList
          listId="feeds"
          label={s.listLabel}
          groups={groups.map((g) => ({
            id: g.category || '_none',
            label: g.category || (grouped ? s.ungrouped : s.allFeeds),
            count: g.feeds.length,
            children: g.feeds.map((feed) => (
              <ItemRow
                key={feed.id}
                title={feed.title}
                meta={hostOf(feed.url)}
                href={feed.siteUrl || feed.url}
                menuLabel={s.rowMenu(feed.title)}
                menu={[
                  {
                    id: 'edit',
                    label: s.edit,
                    onSelect: () =>
                      setDraft({
                        id: feed.id,
                        title: feed.title,
                        url: feed.url,
                        category: feed.category,
                      }),
                  },
                  {
                    id: 'delete',
                    label: s.remove,
                    danger: true,
                    onSelect: () => void deleteWithUndo(() => feedRepo.remove(feed.id)),
                  },
                ]}
              />
            )),
          }))}
        />
      ) : null}
      <Dialog
        open={draft !== null}
        onClose={close}
        title={draft?.id ? s.edit : s.add}
        dirty={draft !== null && (draft.url !== '' || draft.title !== '')}
        footer={
          <>
            <Button onClick={close}>{t.actions.cancel}</Button>
            <Button variant="primary" type="submit" form="feed-form">
              {t.actions.save}
            </Button>
          </>
        }
      >
        {draft ? (
          <form
            id="feed-form"
            onSubmit={(e) => void save(e)}
            style={{ display: 'grid', gap: 'var(--space-3)' }}
          >
            <TextField
              label={s.fields.url}
              hint={s.fields.urlHint}
              value={draft.url}
              required
              data-autofocus
              inputMode="url"
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              error={error || undefined}
            />
            <TextField
              label={s.fields.title}
              hint={s.fields.titleHint}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            <TextField
              label={s.fields.category}
              value={draft.category}
              list="feed-categories"
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            />
            <datalist id="feed-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </form>
        ) : null}
      </Dialog>
    </>
  );
}
