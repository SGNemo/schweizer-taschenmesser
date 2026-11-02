import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { Stored } from '@/core/db/types';
import { now } from '@/core/time/now';
import { deleteWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import { Button, Icon, IconButton, Skeleton } from '@/ui';
import { randomId } from '@/core/db/util';
import { createAutosaver } from '../editor/autosave';
import { clearDraft, loadDraft, saveDraft } from '../editor/draft';
import { wordCount } from '../editor/markdown';
import { SCRATCH_ID } from '../logic';
import { noteRepo } from '../repo';
import type { Note } from '../schema';
import type { NotesSettings } from '../settings';
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
  const readBody = useRef<() => string>(() => initial.body);
  const titleRef = useRef(initial.title);
  const wantFocus = useRef(false);
  const apiRef = useRef<{ clear: () => void; focus: () => void } | null>(null);
  const callbacks = useRef(props);
  useEffect(() => {
    callbacks.current = props;
  });

  const persist = useCallback(
    async ({ title: rawTitle, body }: Snapshot) => {
      const id = idRef.current;
      if (scratch) {
        const data = { title: t.notes.scratch, body, pinned: true };
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
          else await noteRepo.create({ ...data, pinned: false }, { id: pendingId });
          idRef.current = pendingId;
          clearDraft('new');
          setPageId(pendingId);
          callbacks.current.onCreated(pendingId);
        }
      }
      setWords(wordCount(body));
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
          {!scratch && pageId ? (
            <IconButton label={t.notes.pin} aria-pressed={pinned} onClick={() => void togglePin()}>
              <Icon name="pin" size={20} />
            </IconButton>
          ) : null}
          <IconButton
            label={focusMode ? t.notes.writingModeOff : t.notes.writingMode}
            aria-pressed={focusMode}
            onClick={props.onToggleFocus}
          >
            <Icon name={focusMode ? 'close' : 'eye'} size={20} />
          </IconButton>
          <IconButton label={t.notes.fullscreen} onClick={props.onFullscreen}>
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
      <footer className={styles.foot} aria-live="polite">
        <span>{status === 'saving' ? t.notes.saving : t.notes.saved}</span>
        {prefs.wordCount ? <span>{t.notes.words(words)}</span> : null}
      </footer>
    </section>
  );
}
