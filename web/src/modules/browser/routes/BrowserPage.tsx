import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { bus } from '@/core/events';
import { useModuleStates } from '@/core/modules/activation';
import { getPlatform } from '@/core/platform';
import { useSettings } from '@/core/settings/settings';
import { deleteWithUndo } from '@/core/undo/withToast';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, EmptyState, Icon, IconButton, ItemList, ItemRow, TextField } from '@/ui';
import { engineTemplate } from '../lib/searchEngines';
import { resolveInput } from '../lib/omnibox';
import { displayUrl, hostOf, isWebUrl } from '../lib/urlPolicy';
import { blockruleRepo, bookmarkRepo, historyRepo } from '../repo';
import { settings, type BrowserPrefs } from '../settings';
import { useBrowserTabs } from '../tabsStore';
import styles from './BrowserPage.module.css';

type View = 'page' | 'menu' | 'bookmarks' | 'history' | 'blocker' | 'clear';

export default function BrowserPage() {
  const platform = getPlatform().browser;
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const states = useModuleStates();
  const [stored] = useSettings('module.browser', settings.schema, settings.defaults);
  const prefs = (stored ?? settings.defaults) as BrowserPrefs;
  const { tabs, activeId, pausedHosts } = useBrowserTabs();
  const tab = tabs.find((x) => x.id === activeId) ?? null;
  const [view, setView] = useState<View>('page');
  // What the user is typing; shown instead of the tab's address until the next navigation.
  const [draft, setDraft] = useState<{ tab: number | null; text: string } | null>(null);
  const [hintOpen, setHintOpen] = useState(true);
  const area = useRef<HTMLDivElement>(null);

  const marks = useLiveQuery(() => bookmarkRepo.active().toArray(), []);
  const visits = useLiveQuery(
    async () => (await historyRepo.active().toArray()).reverse().slice(0, 100),
    [],
  );
  const rules = useLiveQuery(() => blockruleRepo.active().toArray(), []);

  const template = engineTemplate(prefs.engine, prefs.customUrl);
  const current = tab && tab.opened ? tab.url : '';
  const marked = marks?.find((m) => m.url === current);

  const input = draft && draft.tab === activeId ? draft.text : current;
  const setInput = (text: string) => setDraft({ tab: activeId, text });

  // Tell the native side what to hold back and block.
  useEffect(() => {
    if (!platform.supported) return;
    void platform.configure({
      warnHttp: prefs.httpWarning,
      blockerEnabled: prefs.blocker,
      rules: (rules ?? []).map((r) => ({ kind: r.kind, value: r.value })),
      pausedHosts,
    });
  }, [platform, prefs.httpWarning, prefs.blocker, rules, pausedHosts]);

  const open = useCallback(
    async (text: string, id: number | null = activeId, allowHttp = false) => {
      const res = resolveInput(text, template);
      if (!res) return;
      const target = id ?? useBrowserTabs.getState().newTab();
      setView('page');
      setDraft(null);
      await useBrowserTabs.getState().go(target, res.url, allowHttp);
    },
    [activeId, template],
  );

  // `?url=` (from the widget tiles) opens an address once.
  useEffect(() => {
    const url = params.get('url');
    if (!url || !platform.supported) return;
    setParams({}, { replace: true });
    if (isWebUrl(url)) queueMicrotask(() => void open(url, useBrowserTabs.getState().newTab()));
  }, [params, platform, open, setParams]);

  // Place the native tab exactly over the area; hide it whenever a Nemo panel is shown.
  const showing = view === 'page' && !!tab?.opened && !tab.held;
  useLayoutEffect(() => {
    if (!platform.supported) return;
    const el = area.current;
    const place = () => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const bounds = { x: r.left, y: r.top, width: r.width, height: r.height };
      useBrowserTabs.getState().setBounds(bounds);
      if (showing && activeId !== null) void platform.show(activeId, bounds);
    };
    if (!showing) void platform.show(null);
    place();
    const ro = new ResizeObserver(place);
    if (el) ro.observe(el);
    window.addEventListener('resize', place);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [platform, showing, activeId]);
  // Leaving the page hides the tabs (they stay alive in the background).
  useEffect(
    () => () => {
      if (platform.supported) void platform.show(null);
    },
    [platform],
  );

  const toast = useUiStore.getState().toast;
  const hosts = useMemo(
    () => (tab?.hosts ?? []).filter((h) => h !== hostOf(current)),
    [tab, current],
  );

  async function toggleBookmark() {
    if (!tab || !isWebUrl(current)) return;
    if (marked) {
      await deleteWithUndo(() => bookmarkRepo.remove(marked.id), t.browser.bookmarks.removed);
    } else {
      await bookmarkRepo.create({ title: tab.title || displayUrl(current), url: current });
      toast(t.browser.bookmarks.added);
    }
  }

  function saveToList() {
    if (!tab || !isWebUrl(current)) return;
    if (!states?.bookmarks) return void toast(t.browser.listOff);
    void bus.emit('bookmark.requested', { title: tab.title || displayUrl(current), url: current });
    toast(t.browser.savedToList);
    setView('page');
  }

  function saveAsNote() {
    if (!tab || !isWebUrl(current)) return;
    const q = new URLSearchParams({
      new: '1',
      title: tab.title || displayUrl(current),
      text: current,
    });
    void navigate(`/notes?${q.toString()}`);
  }

  async function blockHost(host: string) {
    await blockruleRepo.create({ kind: 'domain', value: host });
    toast(t.browser.blocker.ruleAdded);
  }

  if (!platform.supported) {
    return (
      <>
        <h1>{t.browser.meta.name}</h1>
        <EmptyState title={t.browser.unsupported.title}>{t.browser.unsupported.body}</EmptyState>
      </>
    );
  }

  const mark = tab?.isPrivate ? (
    <span className={styles.private}>{t.browser.toolbar.privateTab}</span>
  ) : null;

  return (
    <div className={styles.root}>
      <nav className={styles.tabs} aria-label={t.browser.toolbar.tabs}>
        {tabs.map((x) => (
          <div key={x.id} className={`${styles.tab} ${x.id === activeId ? styles.tabActive : ''}`}>
            <button
              type="button"
              aria-current={x.id === activeId ? 'page' : undefined}
              className={styles.tabTitle}
              onClick={() => {
                useBrowserTabs.getState().setActive(x.id);
                setView('page');
              }}
            >
              {x.isPrivate ? '◐ ' : ''}
              {x.title || (x.opened ? displayUrl(x.url) : t.browser.toolbar.untitled)}
            </button>
            <IconButton
              label={t.browser.toolbar.closeTab}
              onClick={() => void useBrowserTabs.getState().closeTab(x.id)}
            >
              <Icon name="close" />
            </IconButton>
          </div>
        ))}
        <IconButton
          label={t.browser.toolbar.newTab}
          onClick={() => {
            useBrowserTabs.getState().newTab();
            setView('page');
          }}
        >
          <Icon name="plus" />
        </IconButton>
      </nav>

      <form
        className={styles.bar}
        onSubmit={(e) => {
          e.preventDefault();
          void open(input);
        }}
      >
        <IconButton
          label={t.browser.toolbar.back}
          disabled={!tab?.opened}
          onClick={() => tab && void platform.back(tab.id)}
        >
          <Icon name="chevronLeft" />
        </IconButton>
        <IconButton
          label={t.browser.toolbar.forward}
          disabled={!tab?.opened}
          onClick={() => tab && void platform.forward(tab.id)}
        >
          <Icon name="chevronRight" />
        </IconButton>
        <IconButton
          label={t.browser.toolbar.reload}
          disabled={!tab?.opened}
          onClick={() => tab && void platform.reload(tab.id)}
        >
          <Icon name="sync" />
        </IconButton>
        <div className={styles.address}>
          <TextField
            label={t.browser.toolbar.address}
            labelHidden
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={(e) => e.target.select()}
            placeholder={t.browser.toolbar.address}
            data-autofocus
          />
        </div>
        {mark}
        <IconButton
          label={marked ? t.browser.toolbar.removeBookmark : t.browser.toolbar.addBookmark}
          disabled={!isWebUrl(current)}
          onClick={() => void toggleBookmark()}
        >
          <Icon name="star" />
        </IconButton>
        <IconButton
          label={t.browser.toolbar.menu}
          onClick={() => setView(view === 'menu' ? 'page' : 'menu')}
        >
          <Icon name="more" />
        </IconButton>
      </form>

      {prefs.hint && hintOpen ? (
        <div className={styles.hint}>
          <span>{t.browser.hint}</span>
          <IconButton label={t.browser.hintClose} onClick={() => setHintOpen(false)}>
            <Icon name="close" />
          </IconButton>
        </div>
      ) : null}

      <div ref={area} className={`${styles.area} ${showing ? styles.native : ''}`}>
        {view === 'menu' ? (
          <ItemList label={t.browser.toolbar.menu}>
            <ItemRow
              title={t.browser.menu.saveToList}
              lead={<Icon name="bookmark" />}
              onOpen={saveToList}
            />
            <ItemRow
              title={t.browser.menu.saveAsNote}
              lead={<Icon name="note" />}
              onOpen={saveAsNote}
            />
            <ItemRow
              title={t.browser.menu.openSystem}
              lead={<Icon name="external" />}
              onOpen={() => {
                if (isWebUrl(current)) void getPlatform().app.openUrl(current);
              }}
            />
            <ItemRow
              title={t.browser.menu.zoom(Math.round((tab?.zoom ?? 1) * 100))}
              meta={t.browser.menu.findHint}
              lead={<Icon name="search" />}
              end={
                <span className={styles.actions}>
                  <IconButton
                    label={t.browser.menu.zoomOut}
                    onClick={() => tab && void useBrowserTabs.getState().zoomBy(tab.id, -0.1)}
                  >
                    <Icon name="minus" />
                  </IconButton>
                  <IconButton
                    label={t.browser.menu.zoomIn}
                    onClick={() => tab && void useBrowserTabs.getState().zoomBy(tab.id, 0.1)}
                  >
                    <Icon name="plus" />
                  </IconButton>
                  <IconButton
                    label={t.browser.menu.zoomReset}
                    onClick={() => tab && void useBrowserTabs.getState().zoomBy(tab.id, 'reset')}
                  >
                    <Icon name="reset" />
                  </IconButton>
                </span>
              }
            />
            <ItemRow
              title={t.browser.menu.newPrivate}
              lead={<Icon name="lock" />}
              onOpen={() => {
                useBrowserTabs.getState().newTab(true);
                setView('page');
              }}
            />
            <ItemRow
              title={t.browser.menu.bookmarks}
              lead={<Icon name="star" />}
              onOpen={() => setView('bookmarks')}
            />
            <ItemRow
              title={t.browser.menu.history}
              lead={<Icon name="clock" />}
              onOpen={() => setView('history')}
            />
            <ItemRow
              title={t.browser.menu.blocker}
              meta={tab?.blocked ? t.browser.blocker.blockedCount(tab.blocked) : undefined}
              lead={<Icon name="eye" />}
              onOpen={() => setView('blocker')}
            />
            <ItemRow
              title={t.browser.menu.clearData}
              lead={<Icon name="trash" />}
              onOpen={() => setView('clear')}
            />
          </ItemList>
        ) : view === 'bookmarks' ? (
          <div className={styles.panel}>
            <h2>{t.browser.bookmarks.title}</h2>
            {marks && marks.length === 0 ? (
              <p className={styles.muted}>{t.browser.bookmarks.empty}</p>
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
          </div>
        ) : view === 'history' ? (
          <div className={styles.panel}>
            <h2>{t.browser.history.title}</h2>
            {!prefs.history ? <p className={styles.muted}>{t.browser.history.off}</p> : null}
            {visits && visits.length === 0 ? (
              <p className={styles.muted}>{t.browser.history.empty}</p>
            ) : null}
            <ItemList label={t.browser.history.title}>
              {(visits ?? []).map((v) => (
                <ItemRow
                  key={v.id}
                  title={v.title || displayUrl(v.url)}
                  meta={displayUrl(v.url)}
                  onOpen={() => void open(v.url)}
                />
              ))}
            </ItemList>
            {visits && visits.length > 0 ? (
              <div className={styles.actions}>
                <Button
                  onClick={() =>
                    void deleteWithUndo(async () => {
                      for (const v of await historyRepo.active().toArray())
                        await historyRepo.remove(v.id);
                    }, t.browser.history.cleared)
                  }
                >
                  {t.browser.history.clear}
                </Button>
              </div>
            ) : null}
          </div>
        ) : view === 'blocker' ? (
          <div className={styles.panel}>
            <h2>{t.browser.blocker.title}</h2>
            <p className={styles.muted}>{t.browser.blocker.intro}</p>
            {!prefs.blocker ? <p>{t.browser.blocker.off}</p> : null}
            {tab?.opened ? (
              <>
                <p>{t.browser.blocker.blockedCount(tab.blocked)}</p>
                {hostOf(current) ? (
                  <div className={styles.actions}>
                    <Button onClick={() => useBrowserTabs.getState().togglePause(hostOf(current))}>
                      {pausedHosts.includes(hostOf(current))
                        ? t.browser.blocker.resumeSite
                        : t.browser.blocker.pauseSite}
                    </Button>
                  </div>
                ) : null}
                <h3>{t.browser.blocker.thirdParties}</h3>
                {hosts.length === 0 ? (
                  <p className={styles.muted}>{t.browser.blocker.none}</p>
                ) : null}
                <ItemList label={t.browser.blocker.thirdParties}>
                  {hosts.map((h) => (
                    <ItemRow
                      key={h}
                      title={h}
                      end={
                        <Button onClick={() => void blockHost(h)}>{t.browser.blocker.block}</Button>
                      }
                    />
                  ))}
                </ItemList>
              </>
            ) : null}
            <h3>{t.browser.blocker.rules}</h3>
            {rules && rules.length === 0 ? (
              <p className={styles.muted}>{t.browser.blocker.noRules}</p>
            ) : null}
            <ItemList label={t.browser.blocker.rules}>
              {(rules ?? []).map((r) => (
                <ItemRow
                  key={r.id}
                  title={r.value}
                  actions={
                    <IconButton
                      label={t.browser.blocker.removeRule}
                      onClick={() => void deleteWithUndo(() => blockruleRepo.remove(r.id))}
                    >
                      <Icon name="trash" />
                    </IconButton>
                  }
                />
              ))}
            </ItemList>
          </div>
        ) : view === 'clear' ? (
          <div className={styles.panel}>
            <h2>{t.browser.clear.title}</h2>
            <p>{t.browser.clear.body}</p>
            <div className={styles.actions}>
              <Button onClick={() => setView('page')}>{t.actions.cancel}</Button>
              <Button
                variant="danger"
                onClick={() => {
                  void (async () => {
                    await useBrowserTabs.getState().closeAll();
                    await platform.clearData();
                    toast(t.browser.clear.done);
                    setView('page');
                  })();
                }}
              >
                {t.browser.clear.confirm}
              </Button>
            </div>
          </div>
        ) : tab?.held ? (
          <div className={styles.panel}>
            <h2>{t.browser.http.title}</h2>
            <p>{t.browser.http.body(hostOf(tab.held))}</p>
            <div className={styles.actions}>
              <Button onClick={() => useBrowserTabs.getState().dismissHeld(tab.id)}>
                {t.browser.http.back}
              </Button>
              <Button variant="primary" onClick={() => void open(tab.held!, tab.id, true)}>
                {t.browser.http.proceed}
              </Button>
            </div>
          </div>
        ) : !tab?.opened ? (
          <div className={styles.panel}>
            <h2>{t.browser.start.title}</h2>
            <p className={styles.muted}>{t.browser.start.body}</p>
            <h3>{t.browser.start.bookmarks}</h3>
            {marks && marks.length === 0 ? (
              <p className={styles.muted}>{t.browser.start.none}</p>
            ) : null}
            <ItemList label={t.browser.start.bookmarks}>
              {(marks ?? []).slice(0, 8).map((m) => (
                <ItemRow
                  key={m.id}
                  title={m.title}
                  meta={displayUrl(m.url)}
                  onOpen={() => void open(m.url)}
                />
              ))}
            </ItemList>
            <div className={styles.actions}>
              <Button
                onClick={() => {
                  useBrowserTabs.getState().newTab(true);
                }}
              >
                {t.browser.start.newPrivate}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
