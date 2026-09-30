import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { t } from '@/strings';
import { Button, Dialog, Form, FormActions, Switch, TextArea, TextField } from '@/ui';
import { noteRepo } from '../repo';
import type { Note } from '../schema';

export type NoteTarget = Stored<Note> | { draft: true; title?: string; body?: string } | null;

export function NoteEditor({ target, onClose }: { target: NoteTarget; onClose: () => void }) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog open={target !== null} onClose={onClose} title={existing ? t.notes.edit : t.notes.add}>
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
  draft?: { title?: string; body?: string };
  onClose: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? draft?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? draft?.body ?? '');
  const [pinned, setPinned] = useState(existing?.pinned ?? false);
  const [error, setError] = useState('');

  async function save() {
    if (!title.trim() && !body.trim()) return setError(t.form.required);
    const data = { title: title.trim(), body, pinned };
    if (existing) await noteRepo.update(existing.id, data);
    else await noteRepo.create(data);
    onClose();
  }

  return (
    <Form onSubmit={() => void save()}>
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
      <TextArea
        label={t.notes.body}
        rows={10}
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          setError('');
        }}
      />
      <Switch label={t.notes.pin} checked={pinned} onChange={setPinned} />
      <FormActions
        start={
          existing ? (
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
