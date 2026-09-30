import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { StartDataButton } from '@/core/importer/StartDataButton';
import { bus } from '@/core/events';
import { useModuleStates } from '@/core/modules/activation';
import { getPlatform } from '@/core/platform';
import { useSettings } from '@/core/settings/settings';
import { now } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import {
  Button,
  EmptyState,
  Icon,
  IconButton,
  ItemList,
  ItemRow,
  PageHeader,
  patternStyles,
  Segmented,
  TextField,
  Toolbar,
} from '@/ui';
import { BriefDialog } from '../components/BriefDialog';
import { FeedManager } from '../components/FeedManager';
import { refreshAll } from '../fetch';
import { ago, categoriesInUse, matchesQuery, parseWords, passesFilters } from '../logic';
import { articleRepo, feedRepo } from '../repo';
import type { Article, Category } from '../schema';
import { settings } from '../settings';
import styles from './news.module.css';

const SHOWN = 300;

export default function NewsPage() {
  const toast = useUiStore((st) => st.toast);
  const feeds = useLiveQuery(() => feedRepo.active().toArray(), []);
  const articles = useLiveQuery(() => articleRepo.active().toArray(), []);
  const [prefs] = useSettings('module.news', settings.schema, settings.defaults);
  const moduleStates = useModuleStates();
  const [category, setCategory] = useState<'all' | Category>('all');
  const [view, setView] = useState<'unread' | 'all'>('unread');
  const [query, setQuery] = useState('');
  const [managing, setManaging] = useState(false);
  const [briefing, setBriefing] = useState(false);
  const [busy, setBusy] = useState(false);

  const feedById = useMemo(() => new Map((feeds ?? []).map((f) => [f.id, f])), [feeds]);
  const values = prefs as { keywords: string; muted: string } | undefined;

  const shown = useMemo(() => {
    const keywords = parseWords(values?.keywords ?? '');
    const muted = parseWords(values?.muted ?? '');
    return (articles ?? [])
      .filter((a) => {
        const feed = feedById.get(a.feedId);
        if (!feed || !feed.active) return false;
        if (category !== 'all' && feed.category !== category) return false;
        if (view === 'unread' && a.read) return false;
        if (!passesFilters(a, keywords, muted)) return false;
        return matchesQuery(a, query);
      })
      .sort((a, b) => b.publishedAt - a.publishedAt);
  }, [articles, feedById, category, view, query, values]);

  const used = categoriesInUse(feeds ?? []);
  const categoryOptions = [
    { value: 'all' as const, label: t.news.all },
    ...used.map((c) => ({ value: c, label: t.news.categories[c]! })),
  ];

  async function refresh() {
    setBusy(true);
    try {
      const r = await refreshAll({ force: true });
      toast(t.news.refreshed(r.added, r.failed));
    } finally {
      setBusy(false);
    }
  }

  async function open(a: Article & { id: string }) {
    if (!a.read) await articleRepo.update(a.id, { read: true });
    if (a.url) await getPlatform().app.openUrl(a.url);
    else toast(t.news.noLink);
  }

  async function later(a: Article & { id: string }) {
    if (!a.url) return toast(t.news.noLink);
    if (moduleStates?.bookmarks !== true) return toast(t.news.bookmarksOff);
    await bus.emit('bookmark.requested', { title: a.title, url: a.url });
    await articleRepo.update(a.id, { saved: true });
    toast(t.news.savedToast);
  }

  async function markAllRead() {
    await Promise.all(
      shown.filter((a) => !a.read).map((a) => articleRepo.update(a.id, { read: true })),
    );
  }

  const noFeeds = feeds && feeds.length === 0;

  return (
    <>
      <PageHeader title={t.news.title}>
        {noFeeds ? <StartDataButton moduleId="news" /> : null}
        <Button onClick={() => setManaging(true)}>{t.news.manageFeeds}</Button>
        {feeds && feeds.length > 0 ? (
          <Button onClick={() => setBriefing(true)}>
            <Icon name="sparkles" size={18} />
            {t.news.brief.button}
          </Button>
        ) : null}
        <Button variant="primary" disabled={busy || noFeeds} onClick={() => void refresh()}>
          <Icon name="sync" size={18} />
          {busy ? t.news.refreshing : t.news.refresh}
        </Button>
      </PageHeader>

      {noFeeds ? <EmptyState icon="note" title={t.news.empty} /> : null}

      {feeds && feeds.length > 0 ? (
        <>
          <Toolbar>
            {used.length > 1 ? (
              <Segmented
                label={t.news.category}
                value={category}
                options={categoryOptions}
                onChange={setCategory}
              />
            ) : null}
            <Segmented
              label={t.news.statusFilter}
              value={view}
              options={[
                { value: 'unread', label: t.news.unread },
                { value: 'all', label: t.news.everything },
              ]}
              onChange={setView}
            />
            <Button onClick={() => void markAllRead()} disabled={!shown.some((a) => !a.read)}>
              {t.news.markAllRead}
            </Button>
          </Toolbar>
          <TextField
            label={t.news.search}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className={patternStyles.spacer} />
          {articles && shown.length === 0 ? (
            <EmptyState
              icon="note"
              title={articles.length === 0 ? t.news.emptyArticles : t.news.emptyFiltered}
            />
          ) : null}
          <ItemList layout="grid" label={t.news.title}>
            {shown.slice(0, SHOWN).map((a) => (
              <ItemRow
                key={a.id}
                title={<span className={a.read ? styles.read : styles.unreadTitle}>{a.title}</span>}
                meta={
                  <>
                    {t.news.from(feedById.get(a.feedId)?.title ?? '', ago(a.publishedAt, now()))}
                    {a.teaser ? <span className={styles.teaser}>{a.teaser}</span> : null}
                  </>
                }
                onOpen={() => void open(a)}
                end={
                  <div className={styles.actions}>
                    <IconButton
                      label={a.saved ? t.news.saved : t.news.saveForLater}
                      onClick={() => void later(a)}
                    >
                      <Icon name="bookmark" />
                    </IconButton>
                    <IconButton
                      label={a.read ? t.news.markUnread : t.news.markRead}
                      onClick={() => void articleRepo.update(a.id, { read: !a.read })}
                    >
                      <Icon name={a.read ? 'eye' : 'check'} />
                    </IconButton>
                  </div>
                }
              />
            ))}
          </ItemList>
        </>
      ) : null}

      <FeedManager open={managing} onClose={() => setManaging(false)} />
      <BriefDialog
        open={briefing}
        onClose={() => setBriefing(false)}
        headlines={shown
          .filter((a) => !a.read)
          .slice(0, 30)
          .map((a) => ({ source: feedById.get(a.feedId)?.title ?? '', title: a.title }))}
      />
    </>
  );
}
