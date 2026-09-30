import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { t } from '@/strings';
import { Button, Dialog, Form, FormActions, TextField } from '@/ui';
import { deleteList, listRepo } from '../repo';
import type { PackingList } from '../schema';

export type ListTarget = Stored<PackingList> | { draft: true } | null;

export function ListEditor({
  target,
  onClose,
  onCreated,
  onDeleted,
}: {
  target: ListTarget;
  onClose: () => void;
  onCreated: (id: string) => void;
  onDeleted: () => void;
}) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={existing ? t.packing.editList : t.packing.addList}
    >
      {target ? (
        <Fields
          key={existing?.id ?? 'new'}
          existing={existing}
          onClose={onClose}
          onCreated={onCreated}
          onDeleted={onDeleted}
        />
      ) : null}
    </Dialog>
  );
}

function Fields({
  existing,
  onClose,
  onCreated,
  onDeleted,
}: {
  existing: Stored<PackingList> | null;
  onClose: () => void;
  onCreated: (id: string) => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [note, setNote] = useState(existing?.note ?? '');

  async function save() {
    const data = { name: name.trim(), note: note.trim() || undefined };
    if (existing) await listRepo.update(existing.id, data);
    else onCreated((await listRepo.create(data)).id);
    onClose();
  }

  return (
    <Form onSubmit={() => void save()}>
      <TextField
        label={t.packing.listName}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        data-autofocus
      />
      <TextField label={t.form.note} value={note} onChange={(e) => setNote(e.target.value)} />
      <FormActions
        start={
          existing ? (
            <Button
              variant="danger"
              onClick={async () => {
                await deleteList(existing.id);
                onClose();
                onDeleted();
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
