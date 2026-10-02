import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { undoableWithToast } from '@/core/undo/withToast';
import { t } from '@/strings';
import { Button, Dialog, Form, FormActions, SelectField, TextArea, TextField } from '@/ui';
import { nextOrder } from '../logic';
import { deleteList, listRepo } from '../repo';
import { KINDS, SHOPPING_LIST_ID, type List, type ListKind } from '../schema';

export type ListTarget = Stored<List> | 'new' | null;

export function ListEditor({
  target,
  existing,
  onClose,
  onSaved,
}: {
  target: ListTarget;
  /** Every live list (for the sort key of a new one). */
  existing: readonly Stored<List>[];
  onClose: () => void;
  /** Called with the id of the created or edited list. */
  onSaved: (id: string) => void;
}) {
  const list = target && target !== 'new' ? target : null;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={list ? t.lists.editList : t.lists.newList}
    >
      {target ? (
        <Fields
          key={list?.id ?? 'new'}
          list={list}
          existing={existing}
          onClose={onClose}
          onSaved={onSaved}
        />
      ) : null}
    </Dialog>
  );
}

function Fields({
  list,
  existing,
  onClose,
  onSaved,
}: {
  list: Stored<List> | null;
  existing: readonly Stored<List>[];
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [name, setName] = useState(list?.name ?? '');
  const [kind, setKind] = useState<ListKind>(list?.kind ?? 'checklist');
  const [note, setNote] = useState(list?.note ?? '');
  const [error, setError] = useState('');

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return setError(t.form.required);
    const data = { name: trimmed, kind, note: note.trim() || undefined };
    if (list) {
      await listRepo.update(list.id, data);
      onSaved(list.id);
    } else {
      const created = await listRepo.create({ ...data, order: nextOrder(existing) });
      onSaved(created.id);
    }
    onClose();
  }

  return (
    <Form onSubmit={() => void save()}>
      <TextField
        label={t.lists.listName}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError('');
        }}
        error={error}
        data-autofocus
      />
      <SelectField
        label={t.lists.kind}
        value={kind}
        onChange={(e) => setKind(e.target.value as ListKind)}
      >
        {KINDS.map((k) => (
          <option key={k} value={k}>
            {t.lists.kinds[k]}
          </option>
        ))}
      </SelectField>
      <TextArea
        label={t.lists.note}
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <FormActions
        start={
          list && list.id !== SHOPPING_LIST_ID ? (
            <Button
              variant="danger"
              onClick={() => {
                void undoableWithToast(t.lists.listDeleted, t.lists.listDeleted, () =>
                  deleteList(list.id),
                );
                onClose();
              }}
            >
              {t.lists.deleteList}
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
