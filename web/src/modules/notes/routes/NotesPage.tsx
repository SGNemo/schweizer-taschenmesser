import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { Stored } from '@/core/db/types';
import { bus } from '@/core/events';
import { useModuleStates } from '@/core/modules/activation';
import { offerEnableModule } from '@/core/modules/offerEnable';
import { useSettings } from '@/core/settings/settings';
import { useUiStore } from '@/stores/ui';
import { now } from '@/core/time/now';
import { deleteWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import { useMediaQuery, useOpenParam } from '@/ui';
import { MoveDialog } from '../components/MoveDialog';
import { NotebookDialog } from '../components/NotebookDialog';
import { NotePane } from '../components/NotePane';
import { PageList } from '../components/PageList';
import { TabBar } from '../components/TabBar';
import { TrashDialog } from '../components/TrashDialog';
import {
  displayTitle,
  isScratch,
  type NotebookFilter,
  SCRATCH_ID,
  SORT_MODES,
  type SortMode,
} from '../logic';
import { backlinks as backlinksOf, findPage, suggestTitles } from '../links';
import { noteRepo, notebookRepo } from '../repo';
import type { Note } from '../schema';
import { type NotesSettings, settings as moduleSettings, settingsSchema } from '../settings';
import styles from './NotesPage.module.css';

type Sel = { kind: 'note'; id: string } | { kind: 'scratch' } | { kind: 'new' } | { kind: 'list' };

/* ---- device-local view state (never synced): last page, open tabs, sort ---- */
const LAST_KEY = 'tm-notes-last';
const TABS_KEY = 'tm-notes-tabs';
const SORT_KEY = 'tm-notes-sort';
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}
const readTabs = (): string[] => {
  try {
    const v: unknown = JSON.parse(read(TABS_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};
const readSort = (): SortMode => {
  const v = read(SORT_KEY);
  return SORT_MODES.find((m) => m === v) ?? 'recent';
};

/**
 * The app rebuilds its routes when module states change, which can remount this page shortly after it
 * opened. The chosen page therefore survives a remount: `?new=1` stays in the URL until the user acts,
 * and the last choice is remembered for a minute (module scope, never stored).
 */
let remembered: { sel: Sel; at: number } | null = null;
const recall = (): Sel | null =>
  remembered && now() - remembered.at < 60_000 ? remembered.sel : null;
const remember = (sel: Sel) => {
  remembered = { sel, at: now() };
};

export default function NotesPage() {
  const notes = useLiveQuery(() => noteRepo.active().toArray(), []);
  const bookRows = useLiveQuery(() => notebookRepo.active().toArray(), []);
  const books = useMemo(
    () => [...(bookRows ?? [])].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt),
    [bookRows],
  );
  const moduleStates = useModuleStates();
  const wide = useMediaQuery('(min-width: 900px)');
  const [stored] = useSettings('module.notes', settingsSchema, moduleSettings.defaults as never);
  const prefs = stored ?? (moduleSettings.defaults as NotesSettings);
  const [params, setParams] = useSearchParams();
  const wantsNew = params.get('new') === '1';
  const prefill = useMemo(
    () =>
      wantsNew
        ? { title: params.get('title') ?? undefined, body: params.get('text') ?? undefined }
        : undefined,
    [wantsNew, params],
  );
  const [query, setQuery] = useState('');
  const [filterRaw, setFilter] = useState<NotebookFilter>('all');
  // A deleted notebook falls back to all pages.
  const filter: NotebookFilter =
    filterRaw === 'all' || filterRaw === 'none' || books.some((b) => b.id === filterRaw)
      ? filterRaw
      : 'all';
  const [sort, setSortState] = useState<SortMode>(readSort);
  const [focusMode, setFocusMode] = useState(false);
  const [paneKey, setPaneKey] = useState(0);
  const [picked, setPicked] = useState<Sel | null>(() => (wantsNew ? { kind: 'new' } : recall()));
  const [seenNew, setSeenNew] = useState(wantsNew);
  // A new page that has been stored (still shown under `new` so its pane is not remounted).
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [tabIds, setTabIds] = useState<string[]>(readTabs);
  const [moving, setMoving] = useState<Stored<Note> | null>(null);
  const [bookDialog, setBookDialog] = useState<{
    open: boolean;
    book: (typeof books)[number] | null;
  }>({
    open: false,
    book: null,
  });
  const [trashOpen, setTrashOpen] = useState(false);

  const setSort = (s: SortMode) => {
    setSortState(s);
    write(SORT_KEY, s);
  };
  const addTab = (id: string) =>
    setTabIds((ids) => {
      if (ids.includes(id)) return ids;
      const next = [...ids, id];
      write(TABS_KEY, JSON.stringify(next));
      return next;
    });
  const dropTab = (id: string) =>
    setTabIds((ids) => {
      const next = ids.filter((x) => x !== id);
      write(TABS_KEY, JSON.stringify(next));
      return next;
    });

  function open(next: Sel) {
    setCreatedId(null);
    setPaneKey((k) => k + 1);
    setPicked(next);
    remember(next);
    if (next.kind === 'note') {
      write(LAST_KEY, next.id);
      addTab(next.id);
    }
    if (next.kind === 'scratch') {
      write(LAST_KEY, SCRATCH_ID);
      addTab(SCRATCH_ID);
    }
    if (wantsNew) setParams({}, { replace: true });
  }
  useOpenParam(
    (id) => noteRepo.get(id),
    (n) => open({ kind: 'note', id: n.id }),
  );

  // Quick capture / share target (`?new=1`): a fresh page, once per arrival.
  if (wantsNew && !seenNew) {
    setSeenNew(true);
    setCreatedId(null);
    setPaneKey((k) => k + 1);
    setPicked({ kind: 'new' });
  } else if (!wantsNew && seenNew) {
    setSeenNew(false);
  }

  // Default view: the last page (or the scratch pad) is ready to type into at once; on a phone the list comes first.
  const last = read(LAST_KEY);
  const fallback: Sel | null = !notes
    ? null
    : !wide
      ? { kind: 'list' }
      : last && last !== SCRATCH_ID && notes.some((n) => n.id === last)
        ? { kind: 'note', id: last }
        : { kind: 'scratch' };
  const sel = picked ?? fallback;

  // Keyboard: Ctrl+N / Alt+N opens a new page (browsers keep Ctrl+N for a new window; the installed app and
  // the desktop app deliver it), Alt+Z the scratch pad.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey || e.isComposing) return;
      const newPage = (e.ctrlKey || e.altKey) && !(e.ctrlKey && e.altKey) && e.code === 'KeyN';
      const scratchKey = e.altKey && !e.ctrlKey && e.code === 'KeyZ';
      if (!newPage && !scratchKey) return;
      e.preventDefault();
      open(newPage ? { kind: 'new' } : { kind: 'scratch' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const scratchNote = notes?.find(isScratch) ?? null;
  const current = sel && sel.kind === 'note' ? (notes?.find((n) => n.id === sel.id) ?? null) : null;
  const activeId =
    sel?.kind === 'note'
      ? sel.id
      : sel?.kind === 'scratch'
        ? SCRATCH_ID
        : sel?.kind === 'new'
          ? createdId
          : null;
  const showList = !focusMode && (wide || sel?.kind === 'list');
  const showPane = sel !== null && sel.kind !== 'list';
  const newPageBook = filter !== 'all' && filter !== 'none' ? filter : null;

  const titleOf = (n: Stored<Note>) =>
    isScratch(n) ? t.notes.scratch : displayTitle(n) || t.notes.untitled;
  const openTabs = tabIds
    .map((id) => (id === SCRATCH_ID ? scratchNote : notes?.find((n) => n.id === id)))
    .filter((n): n is Stored<Note> => !!n);

  function openPage(page: Stored<Note>) {
    open(page.id === SCRATCH_ID ? { kind: 'scratch' } : { kind: 'note', id: page.id });
  }
  function closeTab(id: string) {
    dropTab(id);
    if (id !== activeId) return;
    const rest = openTabs.filter((n) => n.id !== id);
    const next = rest[rest.length - 1];
    if (next) openPage(next);
    else open(wide ? { kind: 'scratch' } : { kind: 'list' });
  }
  async function moveSelectionToNewPage(markdown: string) {
    const created = await noteRepo.create({
      title: '',
      body: markdown,
      pinned: false,
      notebookId: newPageBook,
      order: 0,
    });
    open({ kind: 'note', id: created.id });
  }

  const linkTitles = useCallback((query: string) => suggestTitles(query, notes ?? []), [notes]);
  async function openLink(target: string) {
    const existing = findPage(target, notes ?? []);
    if (existing) return openPage(existing);
    const created = await noteRepo.create({
      title: target,
      body: '',
      pinned: false,
      notebookId: newPageBook,
      order: 0,
    });
    useUiStore.getState().toast(t.notes.links.created);
    open({ kind: 'note', id: created.id });
  }
  function sendTodo(text: string) {
    const send = async () => {
      await bus.emit('todo.requested', { title: text });
      useUiStore.getState().toast(t.notes.links.todoAdded);
    };
    if (moduleStates?.todos !== true)
      return offerEnableModule('todos', t.notes.links.todoOff, send);
    void send();
  }
  const subject = sel?.kind === 'note' ? current : sel?.kind === 'scratch' ? scratchNote : null;
  const backlinkList = subject
    ? backlinksOf(subject, notes ?? []).map((n) => ({ id: n.id, title: titleOf(n) }))
    : [];

  const fullscreen = () => {
    const el = document.documentElement;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => undefined);
  };

  // A stored page is shown once the list has loaded (the pane keeps the text it opened with).
  const waiting = sel?.kind !== 'new' && notes === undefined;
  const loadingPane = waiting || (sel?.kind === 'note' && !current);
  return (
    <>
      <h1 className="sr-only">{t.notes.title}</h1>
      <div
        className={focusMode ? `${styles.root} ${styles.focus}` : styles.root}
        data-writing={focusMode || undefined}
      >
        {showList ? (
          <PageList
            pages={notes}
            books={books}
            filter={filter}
            onFilter={setFilter}
            sort={sort}
            onSort={setSort}
            query={query}
            onQuery={setQuery}
            activeId={activeId}
            openIds={openTabs.map((n) => n.id)}
            showOpenList={!wide}
            onOpen={(p) => (p.id === 'scratch' ? open({ kind: 'scratch' }) : openPage(p))}
            onCloseTab={closeTab}
            onNewPage={() => open({ kind: 'new' })}
            onNewNotebook={() => setBookDialog({ open: true, book: null })}
            onEditNotebook={(book) => setBookDialog({ open: true, book })}
            onTogglePin={(p) => void noteRepo.update(p.id, { pinned: !p.pinned })}
            onMove={setMoving}
            onDelete={(p) => {
              dropTab(p.id);
              void deleteWithUndo(() => noteRepo.remove(p.id)).then(() => {
                if (p.id === activeId) open(wide ? { kind: 'scratch' } : { kind: 'list' });
              });
            }}
            onReorder={(patches) =>
              void (async () => {
                for (const x of patches) await noteRepo.update(x.id, { order: x.order });
              })()
            }
            onOpenTrash={() => setTrashOpen(true)}
          />
        ) : null}
        {showPane && !loadingPane ? (
          <div className={styles.paneHost}>
            {wide ? (
              <TabBar
                tabs={openTabs.map((n) => ({
                  id: n.id,
                  title: titleOf(n),
                  active: n.id === activeId,
                }))}
                onSelect={(id) => {
                  const page = openTabs.find((n) => n.id === id);
                  if (page) openPage(page);
                }}
                onClose={closeTab}
              />
            ) : null}
            <NotePane
              key={paneKey}
              existing={sel.kind === 'note' ? current : sel.kind === 'scratch' ? scratchNote : null}
              scratch={sel.kind === 'scratch'}
              prefill={sel.kind === 'new' ? prefill : undefined}
              prefs={prefs}
              focusMode={focusMode}
              notebookId={newPageBook}
              onMoveSelection={(md) => void moveSelectionToNewPage(md)}
              linkTitles={linkTitles}
              onOpenLink={(target) => void openLink(target)}
              onTodo={sendTodo}
              backlinks={backlinkList}
              onOpenPage={(id) => {
                const page = notes?.find((n) => n.id === id);
                if (page) openPage(page);
              }}
              onToggleFocus={() => setFocusMode((v) => !v)}
              onFullscreen={fullscreen}
              onBack={
                wide
                  ? undefined
                  : () => {
                      remember({ kind: 'list' });
                      setPicked({ kind: 'list' });
                    }
              }
              onCreated={(id) => {
                write(LAST_KEY, id);
                remember({ kind: 'note', id });
                addTab(id);
                setCreatedId(id);
                if (wantsNew) setParams({}, { replace: true });
              }}
              onDeleted={() => {
                if (activeId) dropTab(activeId);
                open(wide ? { kind: 'scratch' } : { kind: 'list' });
              }}
              autoFocus={wide || sel.kind === 'new'}
            />
          </div>
        ) : null}
      </div>
      <MoveDialog
        open={moving !== null}
        books={books}
        current={moving?.notebookId ?? null}
        onClose={() => setMoving(null)}
        onPick={(notebookId) => {
          if (moving) void noteRepo.update(moving.id, { notebookId });
          setMoving(null);
        }}
      />
      <NotebookDialog
        open={bookDialog.open}
        notebook={bookDialog.book}
        books={books}
        pageIds={(notes ?? []).filter((n) => n.notebookId === bookDialog.book?.id).map((n) => n.id)}
        onClose={() => setBookDialog((d) => ({ ...d, open: false }))}
        onSaved={(id) => setFilter(id)}
      />
      <TrashDialog open={trashOpen} onClose={() => setTrashOpen(false)} />
    </>
  );
}
