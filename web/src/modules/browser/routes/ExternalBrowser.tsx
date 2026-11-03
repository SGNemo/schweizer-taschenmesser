import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { getPlatform } from '@/core/platform';
import { useSettings } from '@/core/settings/settings';
import { deleteWithUndo } from '@/core/undo/withToast';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Icon, IconButton, ItemList, ItemRow, PageTitle, TextField } from '@/ui';
import { engineTemplate } from '../lib/searchEngines';
import { resolveInput } from '../lib/omnibox';
import { displayUrl, isWebUrl } from '../lib/urlPolicy';
import { bookmarkRepo, historyRepo } from '../repo';
import { settings, type BrowserPrefs } from '../settings';
import styles from './BrowserPage.module.css';

/**
 * Browser on Android: the page itself opens in a Chrome Custom Tab (the system browser inside the
 * app, with its own cookies, tabs, find, zoom and settings). Nemo keeps what it can do without
 * touching the page: address/search bar, bookmarks and history (recorded when an address is
 * opened here; nothing flows back from the Custom Tab).
 */
export default function ExternalBrowser() {
  const tabs = getPlatform().customTabs;
  const [stored] = useSettings('module.browser', settings.schema, settings.defaults);
  const prefs = (stored ?? settings.defaults) as BrowserPrefs;
  const [text, setText] = useState('');
  const [last, setLast] = useState('');
  const toast = useUiStore.getState().toast;

  const marks = useLiveQuery(() => bookmarkRepo.active().toArray(), []);
  const visits = useLiveQuery(
    async () => (await historyRepo.active().toArray()).reverse().slice(0, 30),
    [],
  );
  const template = engineTemplate(prefs.engine, prefs.customUrl);
  const marked = marks?.find((m) => m.url === last);

  async function open(input: string) {
    const res = resolveInput(input, template);
    if (!res) return;
    setLast(res.url);
    setText('');
    if (prefs.history) await historyRepo.create({ title: '', url: res.url });
    try {
      await tabs.open(res.url);
    } catch {
      // No Custom Tabs on this device: the default browser does the same job.
      try {
        await getPlatform().app.openUrl(res.url);
      } catch {
        toast(t.browser.external.failed);
      }
    }
  }

  async function toggleBookmark() {
    if (!isWebUrl(last)) return;
    if (marked) {
      await deleteWithUndo(() => bookmarkRepo.remove(marked.id), t.browser.bookmarks.removed);
    } else {
      await bookmarkRepo.create({ title: displayUrl(last), url: last });
      toast(t.browser.bookmarks.added);
    }
  }

  return (
    <div className={styles.root}>
      <PageTitle title={t.browser.meta.name} />
      <form
        className={styles.bar}
        onSubmit={(e) => {
          e.preventDefault();
          void open(text);
        }}
      >
        <div className={styles.address}>
          <TextField
            label={t.browser.toolbar.address}
            labelHidden
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.browser.toolbar.address}
            data-autofocus
          />
        </div>
        <IconButton label={t.browser.toolbar.go} onClick={() => void open(text)}>
          <Icon name="search" />
        </IconButton>
        <IconButton
          label={marked ? t.browser.toolbar.removeBookmark : t.browser.toolbar.addBookmark}
          disabled={!isWebUrl(last)}
          onClick={() => void toggleBookmark()}
        >
          <Icon name="star" />
        </IconButton>
      </form>
      <p className={styles.muted}>{t.browser.external.hint}</p>

      <div className={styles.panel}>
        <h2>{t.browser.bookmarks.title}</h2>
        {marks && marks.length === 0 ? (
          <p className={styles.muted}>{t.browser.external.noBookmarks}</p>
        ) : null}
        <ItemList label={t.browser.bookmarks.title}>
          {(marks ?? []).map((m) => (
            <ItemRow
              key={m.id}
              title={m.title}
              meta={displayUrl(m.url)}
              onOpen={() => void open(m.url)}
              actions={
                <IconButton
                  label={t.actions.delete}
                  onClick={() =>
                    void deleteWithUndo(
                      () => bookmarkRepo.remove(m.id),
                      t.browser.bookmarks.removed,
                    )
                  }
                >
                  <Icon name="trash" />
                </IconButton>
              }
            />
          ))}
        </ItemList>
        {visits && visits.length > 0 ? (
          <>
            <h2>{t.browser.start.recent}</h2>
            <ItemList label={t.browser.start.recent}>
              {visits.map((v) => (
                <ItemRow
                  key={v.id}
                  title={v.title || displayUrl(v.url)}
                  meta={displayUrl(v.url)}
                  onOpen={() => void open(v.url)}
                />
              ))}
            </ItemList>
          </>
        ) : null}
      </div>
    </div>
  );
}
