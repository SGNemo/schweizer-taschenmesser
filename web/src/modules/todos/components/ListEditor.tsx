import { useState, type FormEvent } from 'react';
import type { Stored } from '@/core/db/types';
import { Button, Dialog, patternStyles, TextField } from '@/ui';
import { t } from '@/strings';
import { deleteList, listRepo } from '../repo';
import type { TodoList } from '../schema';

interface Props {
  /** `null` = closed, `'new'` = create, a list = rename/delete. */
  target: Stored<TodoList> | 'new' | null;
  nextOrder: number;
  onClose: (createdId?: string) => void;
}

export function ListEditor({ target, nextOrder, onClose }: Props) {
  return (
    <Dialog
      open={target !== null}
      onClose={() => onClose()}
      title={target === 'new' ? t.todos.newList : t.todos.renameList}
    >
      {target ? (
        <ListForm
          key={target === 'new' ? 'new' : target.id}
          target={target}
          nextOrder={nextOrder}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

function ListForm({
  target,
  nextOrder,
  onClose,
}: {
  target: Stored<TodoList> | 'new';
  nextOrder: number;
  onClose: Props['onClose'];
}) {
  const existing = target === 'new' ? null : target;
  const [name, setName] = useState(existing?.name ?? '');

  async function save(e: FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    if (existing) {
      await listRepo.update(existing.id, { name: value });
      onClose();
    } else {
      const created = await listRepo.create({ name: value, order: nextOrder });
      onClose(created.id);
    }
  }

  return (
    <form
      onSubmit={save}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
    >
      <TextField
        label={t.todos.listName}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        data-autofocus
      />
      {existing ? <p className={patternStyles.muted}>{t.todos.deleteListHint}</p> : null}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 'var(--space-2)',
          flexWrap: 'wrap',
        }}
      >
        {existing ? (
          <Button
            variant="danger"
            onClick={async () => {
              await deleteList(existing.id);
              onClose();
            }}
          >
            {t.todos.deleteList}
          </Button>
        ) : (
          <span />
        )}
        <span className={patternStyles.hstack}>
          <Button onClick={() => onClose()}>{t.actions.cancel}</Button>
          <Button type="submit" variant="primary">
            {t.actions.save}
          </Button>
        </span>
      </div>
    </form>
  );
}
