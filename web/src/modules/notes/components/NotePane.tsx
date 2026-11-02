import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { Stored } from '@/core/db/types';
import { now } from '@/core/time/now';
import { deleteWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import { Button, Icon, IconButton, Skeleton } from '@/ui';
import { randomId } from '@/core/db/util';
import { useUiStore } from '@/stores/ui';
import { createAutosaver } from '../editor/autosave';
import type { EditorApi } from '../editor/EditorSurface';
import { clearDraft, loadDraft, saveDraft } from '../editor/draft';
import { wordCount } from '../editor/markdown';
import { recordVersion, type Version } from '../editor/versions';
import { SCRATCH_ID } from '../logic';
import { noteRepo } from '../repo';
import type { Note } from '../schema';
import type { NotesSettings } from '../settings';
import { HistoryDialog } from './HistoryDialog';
import styles from './NotePane.module.css';

const EditorSurface = lazy(() => import('../editor/EditorSurface'));

export interface NotePaneProps {
  /** The stored page, or null for a page that is created with its first text. */
  existing: Stored<Note> | null;
  scratch: boolean;
  prefill?: { title?: string; body?: string };
  prefs: NotesSettings;
  focusMode: boolean;
  onToggleFocus: () => void;
  onFullscreen: () => void;
  /** Narrow screens: back to the page list. */
  onBack?: () => void;
  /** Notebook a new page is created in (the notebook currently shown); `null` = "Allgemein". */
  notebookId: string | null;
  /** Scratch pad: the selection becomes a new page (receives its Markdown). */
  onMoveSelection?: (markdown: string) => void;
  /** Titles for the `[[` menu. */
  linkTitles: (query: string) => string[];
  /** A `[[link]]` was clicked: open the page, or create it. */
  onOpenLink: (target: string) => void;
  /** The selection becomes a to-do. */
  onTodo: (text: string) => void;
  /** Pages that link to this one. */
  backlinks: { id: string; title: string }[];
  onOpenPage: (id: string) => void;
  onCreated: (id: string) => void;
  onDeleted: () => void;
  autoFocus: boolean;
}

type Snapshot = { title: string; body: string };

/** One open page: title, rich-text surface, autosave (no save button), crash draft, word count. */
export function NotePane(props: NotePaneProps) {
  const { existing, scratch, prefill, prefs, focusMode } = props;
  const [pageId, setPageId] = useState<string | null>(
    existing?.id ?? (scratch ? SCRATCH_ID : null),
  );
  const idRef = useRef<string | null>(pageId);
  // A page that is not stored yet gets its id up front (kept in the crash draft), so a remount or a
  // restored draft writes to the same note instead of creating a second one.
  const [pendingId] = useState<string | null>(() =>
    pageId ? null : (loadDraft('new')?.id ?? randomId()),
  );
  // A page that is not stored yet keeps its draft under `new`; once created it moves to its own key.
  const draftKey = pageId ?? 'new';
  const [initial] = useState(() => {
    const stored = {
      title: existing?.title ?? prefill?.title ?? '',
      body: existing?.body ?? prefill?.body ?? '',
    };
    const draft = loadDraft(draftKey);
    const newer =
      draft &&
      draft.at > (existing?.updatedAt ?? 0) &&
      (draft.title !== stored.title || draft.body !== stored.body);
    return newer ? { ...draft, restored: true } : { ...stored, restored: false };
  });
  const [title, setTitle] = useState(initial.title);
  const [status, setStatus] = useState<'saved' | 'saving'>(initial.restored ? 'saving' : 'saved');
  const [words, setWords] = useState(() => wordCount(initial.body));
  const [pinned, setPinned] = useState(existing?.pinned ?? false);
  const [error, setError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const readBody = useRef<() => string>(() => initial.body);
  const titleRef = useRef(initial.title);
  const wantFocus = useRef(false);
  const apiRef = useRef<EditorApi | null>(null);
  const callbacks = useRef(props);
  useEffect(() => {
    callbacks.current = props;
  });

  const persist = useCallback(
    async ({ title: rawTitle, body }: Snapshot) => {
      const id = idRef.current;
      if (scratch) {
        const data = { title: t.notes.scratch, body, pinned: true, notebookId: null, order: 0 };
        if (id && (await noteRepo.table.get(id))) await noteRepo.update(id, data);
        else if (body.trim()) {
          await noteRepo.create(data, { id: SCRATCH_ID });
          idRef.current = SCRATCH_ID;
        }
      } else {
        const data = { title: rawTitle.trim(), body };
        if (id) {
          if (!data.title && !data.body.trim()) return; // never leave a page empty: keep the last text
          await noteRepo.update(id, data);
        } else if (pendingId && (data.title || data.body.trim())) {
          if (await noteRepo.table.get(pendingId)) await noteRepo.update(pendingId, data);
          else
            await noteRepo.create(
              { ...data, pinned: false, notebookId: callbacks.current.notebookId, order: 0 },
              { id: pendingId },
            );
          idRef.current = pendingId;
          clearDraft('new');
          setPageId(pendingId);
          callbacks.current.onCreated(pendingId);
        }
      }
      setWords(wordCount(body));
      const savedId = idRef.current;
      if (savedId) {
        const title = scratch ? t.notes.scratch : rawTitle.trim();
        void recordVersion(savedId, { title, body, at: now() });
      }
    },
    [scratch, pendingId],
  );

  const [saver] = useState(() => createAutosaver<Snapshot>(() => Promise.resolve()));
  useEffect(() => {
    saver.setSave(async (v) => {
      await persist(v);
      if (!saver.pending()) {
        clearDraft(draftKey);
        setStatus('saved');
      }
    });
  }, [saver, persist, draftKey]);
  useEffect(() => () => void saver.flush(), [saver]);

  const draftTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scheduleSave = useCallback(() => {
    saver.schedule(() => ({ title: titleRef.current, body: readBody.current() }));
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(
      () =>
        saveDraft(draftKey, {
          id: pendingId ?? undefined,
          title: titleRef.current,
          body: readBody.current(),
          at: now(),
        }),
      300,
    );
  }, [draftKey, saver, pendingId]);
  const dirty = useCallback(() => {
    setStatus('saving');
    scheduleSave();
  }, [scheduleSave]);

  useEffect(() => {
    // Leaving or hiding the page: the draft is written synchronously first (an IndexedDB write may not
    // finish while the page goes away), then the normal save runs.
    const leave = (onlyWhenHidden: boolean) => {
      if (onlyWhenHidden && document.visibilityState !== 'hidden') return;
      if (saver.pending()) {
        saveDraft(draftKey, {
          id: pendingId ?? undefined,
          title: titleRef.current,
          body: readBody.current(),
          at: now(),
        });
      }
      void saver.flush();
    };
    const onVisibility = () => leave(true);
    const onHide = () => leave(false);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onHide);
      clearTimeout(draftTimer.current);
    };
  }, [saver, draftKey, pendingId]);

  // A restored draft is written back right away, so nothing is lost if the tab dies again.
  useEffect(() => {
    if (initial.restored) scheduleSave();
  }, [initial.restored, scheduleSave]);

  async function openHistory() {
    await saver.flush();
    setHistoryOpen(true);
  }

  /** Puts an earlier state into the editor; the normal autosave stores it, Ctrl+Z steps back. */
  async function restoreVersion(v: Version) {
    await saver.flush();
    if (pageId) {
      const current = { title: titleRef.current, body: readBody.current(), at: now() };
      await recordVersion(pageId, current, { force: true });
    }
    if (!scratch) {
      setTitle(v.title);
      titleRef.current = v.title;
    }
    apiRef.current?.setMarkdown(v.body);
    setHistoryOpen(false);
    useUiStore.getState().toast(t.notes.historyRestored);
  }

  async function togglePin() {
    if (!pageId) return;
    await noteRepo.update(pageId, { pinned: !pinned });
    setPinned(!pinned);
  }

  return (
    <section className={styles.pane} aria-label={t.notes.edit}>
      <div className={styles.bar}>
        {props.onBack ? (
          <IconButton label={t.notes.back} onClick={() => void saver.flush().then(props.onBack)}>
            <Icon name="menu" size={20} />
          </IconButton>
        ) : null}
        {scratch ? (
          <h2 className={styles.scratchTitle}>
            <Icon name="pin" size={16} /> {t.notes.scratch}
          </h2>
        ) : (
          <input
            className={styles.title}
            aria-label={t.notes.titleLabel}
            placeholder={t.notes.titlePlaceholder}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              titleRef.current = e.target.value;
              dirty();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                // The editor loads lazily: when it is not there yet, focus it as soon as it is.
                if (apiRef.current) apiRef.current.focus();
                else wantFocus.current = true;
              }
            }}
            data-autofocus={initial.title === '' && !initial.body ? true : undefined}
          />
        )}
        <div className={styles.actions}>
          {scratch ? (
            <Button variant="ghost" onClick={() => apiRef.current?.clear()}>
              {t.notes.scratchClear}
            </Button>
          ) : null}
          {pageId ? (
            <IconButton label={t.notes.history} onClick={() => void openHistory()}>
              <Icon name="clock" size={20} />
            </IconButton>
          ) : null}
          {!scratch && pageId ? (
            <IconButton label={t.notes.pin} aria-pressed={pinned} onClick={() => void togglePin()}>
              <Icon name="pin" size={20} />
            </IconButton>
          ) : null}
          <IconButton
            label={focusMode ? t.notes.writingModeOff : t.notes.writingMode}
            aria-pressed={focusMode}
            className={styles.wideOnly}
            onClick={props.onToggleFocus}
          >
            <Icon name={focusMode ? 'close' : 'eye'} size={20} />
          </IconButton>
          <IconButton
            label={t.notes.fullscreen}
            className={styles.wideOnly}
            onClick={props.onFullscreen}
          >
            <Icon name="monitor" size={20} />
          </IconButton>
          {!scratch && pageId ? (
            <IconButton
              label={t.actions.delete}
              onClick={() => {
                const id = pageId;
                saver.cancel();
                clearDraft(draftKey);
                void deleteWithUndo(() => noteRepo.remove(id)).then(props.onDeleted);
              }}
            >
              <Icon name="trash" size={20} />
            </IconButton>
          ) : null}
        </div>
      </div>
      {initial.restored ? (
        <p className={styles.note} role="status">
          {t.notes.restored}
        </p>
      ) : null}
      {error ? (
        <p className={styles.note} role="status">
          {error}
        </p>
      ) : null}
      <Suspense fallback={<Skeleton />}>
        <EditorSurface
          initial={initial.body}
          width={prefs.width}
          autoFocus={props.autoFocus}
          apiRef={apiRef}
          onMoveSelection={scratch ? props.onMoveSelection : undefined}
          linkTitles={props.linkTitles}
          onOpenLink={props.onOpenLink}
          onTodo={props.onTodo}
          onReady={() => {
            if (!wantFocus.current) return;
            wantFocus.current = false;
            apiRef.current?.focus();
          }}
          onError={setError}
          onDirty={(read) => {
            readBody.current = read;
            dirty();
          }}
          onBlur={() => void saver.flush()}
        />
      </Suspense>
      {props.backlinks.length > 0 ? (
        <nav className={styles.backlinks} aria-label={t.notes.links.backlinks}>
          <span className={styles.backlinksLabel}>{t.notes.links.backlinks}</span>
          {props.backlinks.map((b) => (
            <button
              key={b.id}
              type="button"
              className={styles.backlink}
              onClick={() => props.onOpenPage(b.id)}
            >
              {b.title}
            </button>
          ))}
        </nav>
      ) : null}
      {pageId ? (
        <HistoryDialog
          open={historyOpen}
          pageId={pageId}
          onClose={() => setHistoryOpen(false)}
          onRestore={(v) => void restoreVersion(v)}
        />
      ) : null}
      <footer className={styles.foot} aria-live="polite">
        <span>{status === 'saving' ? t.notes.saving : t.notes.saved}</span>
        {prefs.wordCount ? <span>{t.notes.words(words)}</span> : null}
      </footer>
    </section>
  );
}
