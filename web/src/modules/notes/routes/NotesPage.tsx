import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { t } from '@/strings';
import {
  Button,
  EmptyState,
  Icon,
  ItemList,
  ItemRow,
  PageHeader,
  patternStyles,
  TextField,
} from '@/ui';
import { NoteEditor, type NoteTarget } from '../components/NoteEditor';
import { displayTitle, excerpt, searchNotes, sortNotes } from '../logic';
import { noteRepo } from '../repo';

export default function NotesPage() {
  const notes = useLiveQuery(() => noteRepo.active().toArray(), []);
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<NoteTarget>(null);
  const [params, setParams] = useSearchParams();

  // `?new=1` opens an empty note; `title`/`text` come from the share page and prefill it.
  const openTarget =
    target ??
    (params.get('new')
      ? {
          draft: true as const,
          title: params.get('title') ?? undefined,
          body: params.get('text') ?? undefined,
        }
      : null);
  const closeEditor = () => {
    setTarget(null);
    if (params.get('new')) setParams({}, { replace: true });
  };

  const shown = useMemo(() => sortNotes(searchNotes(notes ?? [], query)), [notes, query]);

  return (
    <>
      <PageHeader title={t.notes.title}>
        <Button variant="primary" onClick={() => setTarget({ draft: true })}>
          <Icon name="plus" size={18} />
          {t.notes.add}
        </Button>
      </PageHeader>
      <div className={patternStyles.gapBottom}>
        <TextField
          label={t.notes.search}
          labelHidden
          placeholder={t.notes.search}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {notes && shown.length === 0 ? (
        <EmptyState
          icon="note"
          title={notes.length === 0 ? t.notes.empty : t.notes.emptyFiltered}
        />
      ) : null}
      <ItemList layout="grid" label={t.notes.title}>
        {shown.map((n) => (
          <ItemRow
            key={n.id}
            title={
              <>
                {n.pinned ? <Icon name="pin" size={16} /> : null} {displayTitle(n)}
              </>
            }
            meta={excerpt(n)}
            onOpen={() => setTarget(n)}
          />
        ))}
      </ItemList>
      <NoteEditor target={openTarget} onClose={closeEditor} />
    </>
  );
}
