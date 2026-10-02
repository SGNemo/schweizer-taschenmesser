import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { undoableWithToast } from '@/core/undo/withToast';
import { t } from '@/strings';
import { Button, Dialog, Form, FormActions, TextField } from '@/ui';
import { itemRepo } from '../repo';
import type { Item } from '../schema';

export function ItemEditor({ item, onClose }: { item: Stored<Item> | null; onClose: () => void }) {
  return (
    <Dialog open={item !== null} onClose={onClose} title={t.lists.editItem}>
      {item ? <Fields key={item.id} item={item} onClose={onClose} /> : null}
    </Dialog>
  );
}

function Fields({ item, onClose }: { item: Stored<Item>; onClose: () => void }) {
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity ?? '');
  const [error, setError] = useState('');

  async function save() {
    if (!name.trim()) return setError(t.form.required);
    await itemRepo.update(item.id, { name: name.trim(), quantity: quantity.trim() || undefined });
    onClose();
  }

  return (
    <Form onSubmit={() => void save()}>
      <TextField
        label={t.lists.itemName}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError('');
        }}
        error={error}
        data-autofocus
      />
      <TextField
        label={t.lists.quantity}
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
      />
      <FormActions
        start={
          <Button
            variant="danger"
            onClick={() => {
              void undoableWithToast(t.lists.itemDeleted, t.lists.itemDeleted, () =>
                itemRepo.remove(item.id),
              );
              onClose();
            }}
          >
            {t.actions.delete}
          </Button>
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
