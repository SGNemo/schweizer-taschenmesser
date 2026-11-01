import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { StartDataButton } from '@/core/importer/StartDataButton';
import { useSettings } from '@/core/settings/settings';
import { t } from '@/strings';
import {
  Button,
  EmptyState,
  Icon,
  ItemList,
  ItemRow,
  TextField,
  useMediaQuery,
  useOpenParam,
} from '@/ui';
import { NotePane } from '../components/NotePane';
import { displayTitle, excerpt, isScratch, SCRATCH_ID, searchNotes, sortNotes } from '../logic';
import { noteRepo } from '../repo';
import { type NotesSettings, settings as moduleSettings, settingsSchema } from '../settings';
import styles from './NotesPage.module.css';

type Sel = { kind: 'note'; id: string } | { kind: 'scratch' } | { kind: 'new' } | { kind: 'list' };

const LAST_KEY = 'tm-notes-last';
const readLast = (): string | null => {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
};
const writeLast = (id: string) => {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    /* storage unavailable */
  }
};

export default function NotesPage() {
  const notes = useLiveQuery(() => noteRepo.active().toArray(), []);
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
  const [focusMode, setFocusMode] = useState(false);
  const [paneKey, setPaneKey] = useState(0);
  const [picked, setPicked] = useState<Sel | null>(null);
  const [seenNew, setSeenNew] = useState(false);

  function open(next: Sel) {
    setPaneKey((k) => k + 1);
    setPicked(next);
    if (next.kind === 'note') writeLast(next.id);
    if (next.kind === 'scratch') writeLast(SCRATCH_ID);
  }
  useOpenParam(
    (id) => noteRepo.get(id),
    (n) => open({ kind: 'note', id: n.id }),
  );

  // Quick capture / share target (`?new=1`): a fresh page, once per arrival.
  if (wantsNew && !seenNew) {
    setSeenNew(true);
    setPaneKey((k) => k + 1);
    setPicked({ kind: 'new' });
  } else if (!wantsNew && seenNew) {
    setSeenNew(false);
  }
  useEffect(() => {
    if (wantsNew) setParams({}, { replace: true });
  }, [wantsNew, setParams]);

  // Default view: the last page (or the scratch pad) is ready to type into at once; on a phone the list comes first.
  const last = readLast();
  const fallback: Sel | null = !notes
    ? null
    : !wide
      ? { kind: 'list' }
      : last && last !== SCRATCH_ID && notes.some((n) => n.id === last)
        ? { kind: 'note', id: last }
        : { kind: 'scratch' };
  const sel = picked ?? fallback;

  const shown = useMemo(() => sortNotes(searchNotes(notes ?? [], query)), [notes, query]);
  const scratchNote = notes?.find(isScratch) ?? null;
  const current = sel && sel.kind === 'note' ? (notes?.find((n) => n.id === sel.id) ?? null) : null;
  const showList = !focusMode && (wide || sel?.kind === 'list');
  const showPane = sel !== null && sel.kind !== 'list';

  const fullscreen = () => {
    const el = document.documentElement;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => undefined);
  };

  const list = (
    <nav className={styles.list} aria-label={t.notes.pages}>
      <div className={styles.listHead}>
        <Button variant="primary" onClick={() => open({ kind: 'new' })}>
          <Icon name="plus" size={18} />
          {t.notes.newPage}
        </Button>
      </div>
      <TextField
        label={t.notes.search}
        labelHidden
        placeholder={t.notes.search}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {notes && shown.length === 0 && query ? <EmptyState title={t.notes.emptyFiltered} /> : null}
      {notes && notes.length === 0 ? (
        <EmptyState title={t.notes.empty}>
          <StartDataButton moduleId="notes" />
        </EmptyState>
      ) : null}
      <ItemList layout="list" label={t.notes.title}>
        {notes && !query.trim() && !scratchNote ? (
          <ItemRow
            key="scratch-new"
            title={
              <>
                <Icon name="pin" size={16} /> {t.notes.scratch}
              </>
            }
            meta={t.notes.scratchHint}
            onOpen={() => open({ kind: 'scratch' })}
          />
        ) : null}
        {shown.map((n) => (
          <ItemRow
            key={n.id}
            title={
              <>
                {n.pinned || isScratch(n) ? <Icon name="pin" size={16} /> : null}{' '}
                {displayTitle(n) || t.notes.untitled}
              </>
            }
            meta={excerpt(n)}
            onOpen={() => open(isScratch(n) ? { kind: 'scratch' } : { kind: 'note', id: n.id })}
          />
        ))}
      </ItemList>
    </nav>
  );

  const loadingPane = sel?.kind === 'note' && !current && notes !== undefined;
  return (
    <>
      <h1 className="sr-only">{t.notes.title}</h1>
      <div
        className={focusMode ? `${styles.root} ${styles.focus}` : styles.root}
        data-writing={focusMode || undefined}
      >
        {showList ? list : null}
        {showPane && !loadingPane ? (
          <div className={styles.paneHost}>
            <NotePane
              key={paneKey}
              existing={sel.kind === 'note' ? current : sel.kind === 'scratch' ? scratchNote : null}
              scratch={sel.kind === 'scratch'}
              prefill={sel.kind === 'new' ? prefill : undefined}
              prefs={prefs}
              focusMode={focusMode}
              onToggleFocus={() => setFocusMode((v) => !v)}
              onFullscreen={fullscreen}
              onBack={wide ? undefined : () => setPicked({ kind: 'list' })}
              onCreated={(id) => {
                writeLast(id);
                setPicked({ kind: 'note', id });
              }}
              onDeleted={() => (wide ? open({ kind: 'scratch' }) : setPicked({ kind: 'list' }))}
              autoFocus={wide || sel.kind === 'new'}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
