import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState, type FormEvent } from 'react';
import { useLang } from '@/core/i18n/lang';
import { useSearchParams } from 'react-router';
import { collator } from '@/core/i18n/format';
import { getPlatform } from '@/core/platform';
import { today } from '@/core/time/now';
import { buildOpml } from '@/importers/opml/parse';
import { useUiStore } from '@/stores/ui';
import { useSettings } from '@/core/settings/settings';
import { deleteWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import {
  Button,
  Dialog,
  EmptyState,
  GroupedList,
  Icon,
  ItemList,
  ItemRow,
  PageAction,
  PageHeader,
  TextField,
  useOpenParam,
} from '@/ui';
import { formatNumber } from '@/core/i18n/format';
import { HeroFigure, HeroSlot, SignatureMark } from '@/ui/identity';
import { StartDataMenu } from '@/core/importer/StartDataMenu';
import { catalogLang, suggestions, type CatalogEntry } from '../catalog';
import type { FeedPreview } from '../discover';
import { feedKey, groupFeeds, hostOf, normalizeFeedUrl } from '../logic';
import { feedRepo } from '../repo';
import { settings, type FeedsSettings } from '../settings';
import { AddDialog } from './AddDialog';
import { CatalogRow } from './CatalogRow';
import styles from './feeds.module.css';

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
  const [finding, setFinding] = useState(false);
  const [closed, setClosed] = useState(false);
  const [error, setError] = useState('');
  const [params, setParams] = useSearchParams();
  const toast = useUiStore((st) => st.toast);
  const [prefs] = useSettings('module.feeds', settings.schema, settings.defaults);
  const lang = catalogLang(useLang());

  // `?new=1` (quick add, widget) and `?add=<address>` (share sheet) open the add dialog.
  const shared = params.get('add') ?? '';
  const wantsAdd = (params.get('new') !== null || shared !== '') && !closed;
  const addOpen = finding || (wantsAdd && edited === null);
  const draft = edited;
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
  const isEmpty = !!feeds && feeds.length === 0;
  const subscribed = new Set((feeds ?? []).map((f) => feedKey(f.url)));

  /** One tap in the catalogue: subscribed under the group's name, nothing else to fill in. */
  const adding = useRef(new Set<string>());
  async function addEntry(entry: CatalogEntry) {
    const key = feedKey(entry.url);
    // A double tap lands before the live list knows the first one: keys on their way count too.
    if (subscribed.has(key) || adding.current.has(key)) return;
    adding.current.add(key);
    try {
      await feedRepo.create({
        title: entry.title,
        url: entry.url,
        category: s.catalog.categories[entry.category],
        siteUrl: entry.site,
      });
      toast(s.catalog.addedToast(entry.title));
    } catch (e) {
      // Kept on success: the live list may not know the new feed yet.
      adding.current.delete(key);
      throw e;
    }
  }

  /** "Abonnieren" under a preview: the feed's own name, no group yet (it can be set in the list). */
  async function addPreview(feed: FeedPreview, siteUrl?: string) {
    if (subscribed.has(feedKey(feed.url))) return;
    const title = feed.title || hostOf(feed.url);
    const site = siteUrl && feedKey(siteUrl) !== feedKey(feed.url) ? siteUrl : undefined;
    await feedRepo.create({
      title,
      url: feed.url,
      category: '',
      ...(site ? { siteUrl: site } : {}),
    });
    toast(s.catalog.addedToast(title));
  }

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

  async function exportOpml() {
    const data = buildOpml(feeds ?? [], s.opmlTitle);
    const fileName = `nemo-feeds-${today()}.opml`;
    if ((await getPlatform().saveFile({ fileName, data, mime: 'text/x-opml' })) === 'saved')
      toast(s.exported);
  }

  function close() {
    setDraft(null);
    setFinding(false);
    setClosed(true);
    setError('');
    if (params.get('new') !== null || params.get('add') !== null) setParams({}, { replace: true });
  }

  /** From the add dialog to the form: the typed address with name and group still to fill in. */
  function toForm(url: string) {
    setFinding(false);
    setClosed(true);
    setDraft({ ...EMPTY, url });
  }

  return (
    <>
      <PageHeader title={s.title}>
        <PageAction
          short={t.nav.plusThings.feed}
          variant={isEmpty ? 'secondary' : 'primary'}
          onClick={() => setFinding(true)}
        >
          <Icon name="plus" size={18} />
          {s.add}
        </PageAction>
        {/* Import and export in the ⋯ menu: an empty page offers one verb (C23). */}
        <StartDataMenu
          moduleId="feeds"
          items={
            feeds && feeds.length > 0
              ? [{ id: 'export', label: s.exportOpml, onSelect: () => void exportOpml() }]
              : []
          }
        />
      </PageHeader>
      {feeds && feeds.length > 0 ? (
        <HeroSlot area="figure">
          <HeroFigure
            label={s.title}
            value={formatNumber(feeds.length)}
            unit={s.widget.label}
            detail={s.groupsCount(categories.length) || undefined}
            testId="feeds-total"
          />
        </HeroSlot>
      ) : null}
      {feeds && feeds.length === 0 ? (
        <EmptyState
          title={s.empty}
          testId="feeds-empty"
          motif={<SignatureMark id="masthead" size={64} />}
        >
          <p>{s.emptyHint}</p>
          <Button variant="primary" onClick={() => setFinding(true)}>
            {s.add}
          </Button>
        </EmptyState>
      ) : null}
      {isEmpty ? (
        <section aria-labelledby="feeds-suggestions" data-testid="feeds-suggestions">
          <h2 id="feeds-suggestions" className={styles.subhead}>
            {s.suggestions}
          </h2>
          <ItemList>
            {suggestions(lang, subscribed).map((entry) => (
              <CatalogRow
                key={entry.id}
                entry={entry}
                subscribed={subscribed}
                onAdd={(e) => void addEntry(e)}
              />
            ))}
          </ItemList>
        </section>
      ) : null}
      {groups.length > 0 ? (
        <GroupedList
          listId="feeds"
          label={s.listLabel}
          groups={groups.map((g) => ({
            id: g.category || '_none',
            label: g.category || (grouped ? s.ungrouped : s.allFeeds),
            count: g.feeds.length,
            children: (
              <ItemList>
                {g.feeds.map((feed) => (
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
                ))}
              </ItemList>
            ),
          }))}
        />
      ) : null}
      {addOpen ? (
        <AddDialog
          open
          initialQuery={shared}
          subscribed={subscribed}
          onAdd={(e) => void addEntry(e)}
          onSubscribe={(feed, site) => void addPreview(feed, site)}
          onAddress={toForm}
          onClose={close}
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
              {draft?.id ? t.actions.save : s.add}
            </Button>
          </>
        }
      >
        {draft ? (
          <form id="feed-form" onSubmit={(e) => void save(e)} className={styles.form}>
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
