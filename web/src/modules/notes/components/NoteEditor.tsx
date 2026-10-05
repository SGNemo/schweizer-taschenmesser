import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { t } from '@/strings';
import { Button, Dialog, Form, FormActions, ReaderView, Switch, TextArea, TextField } from '@/ui';
import { isScratch, SCRATCH_ID } from '../logic';
import { noteRepo } from '../repo';
import type { Note } from '../schema';

/** `scratch: true` is the not yet created scratch pad (saved with the fixed id). */
export type NoteTarget =
  Stored<Note> | { draft: true; title?: string; body?: string; scratch?: true } | null;

export function NoteEditor({ target, onClose }: { target: NoteTarget; onClose: () => void }) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={
        (existing && isScratch(existing)) || (target && 'scratch' in target)
          ? t.notes.scratch
          : existing
            ? t.notes.edit
            : t.notes.add
      }
    >
      {target ? (
        <Fields
          key={existing?.id ?? 'new'}
          existing={existing}
          draft={existing ? undefined : target}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

function Fields({
  existing,
  draft,
  onClose,
}: {
  existing: Stored<Note> | null;
  draft?: { title?: string; body?: string; scratch?: true };
  onClose: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? draft?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? draft?.body ?? '');
  const [pinned, setPinned] = useState(existing?.pinned ?? false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const scratch = (existing && isScratch(existing)) || draft?.scratch === true;

  async function save() {
    if (scratch) {
      // The pad keeps its title and stays pinned; an empty text is fine ("Zettel leeren").
      const data = { title: t.notes.scratch, body, pinned: true };
      if (existing) await noteRepo.update(existing.id, data);
      else await noteRepo.create(data, { id: SCRATCH_ID });
      return onClose();
    }
    if (!title.trim() && !body.trim()) return setError(t.form.required);
    const data = { title: title.trim(), body, pinned };
    if (existing) await noteRepo.update(existing.id, data);
    else await noteRepo.create(data);
    onClose();
  }

  return (
    <Form onSubmit={() => void save()}>
      {scratch ? null : (
        <TextField
          label={t.form.title}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError('');
          }}
          error={error}
          data-autofocus
        />
      )}
      <TextArea
        label={t.notes.body}
        rows={10}
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          setError('');
        }}
        data-autofocus={scratch ? true : undefined}
      />
      {existing && !scratch && body.trim() ? (
        <div>
          <Button variant="ghost" onClick={() => setReading(true)}>
            {t.settings.reading.focusRead}
          </Button>
          <ReaderView
            open={reading}
            onClose={() => setReading(false)}
            title={title.trim() || t.notes.edit}
            text={body}
          />
        </div>
      ) : null}
      {scratch ? null : <Switch label={t.notes.pin} checked={pinned} onChange={setPinned} />}
      <FormActions
        start={
          existing && scratch ? (
            <Button onClick={() => setBody('')} disabled={!body}>
              {t.notes.scratchClear}
            </Button>
          ) : existing ? (
            <Button
              variant="danger"
              onClick={async () => {
                await noteRepo.remove(existing.id);
                onClose();
              }}
            >
              {t.actions.delete}
            </Button>
          ) : undefined
        }
      >
        <Button onClick={onClose}>{t.actions.cancel}</Button>
        <Button type="submit" variant="primary">
          {t.actions.save}
        </Button>
      </FormActions>
    </Form>
  );
}
