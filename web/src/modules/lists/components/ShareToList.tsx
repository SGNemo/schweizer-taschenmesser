import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { undoableWithToast } from '@/core/undo/withToast';
import { t } from '@/strings';
import { Button, Dialog, FormActions, SelectField } from '@/ui';
import { pickShoppingTarget } from '../logic';
import { addItem } from '../repo';
import type { List } from '../schema';
import styles from './ListManage.module.css';

/**
 * Shared text ("Teilen" → Nemo → "Auf eine Liste"): every line becomes an entry of the list the reader picks (the
 * first shopping list is preselected). Nothing is written before "Hinzufügen"; the add sits behind "Rückgängig".
 */
export function ShareToList({
  entries,
  lists,
  onClose,
  onAdded,
}: {
  /** Lines of the shared text, already cleaned (`sharedEntries`); the dialog is open while there are any. */
  entries: readonly string[];
  /** The lists in use, in tab order. */
  lists: readonly Stored<List>[];
  onClose: () => void;
  onAdded: (listId: string) => void;
}) {
  const open = entries.length > 0 && lists.length > 0;
  return (
    <Dialog open={open} onClose={onClose} title={t.lists.shareTo}>
      {open ? <Fields entries={entries} lists={lists} onClose={onClose} onAdded={onAdded} /> : null}
    </Dialog>
  );
}

function Fields({
  entries,
  lists,
  onClose,
  onAdded,
}: {
  entries: readonly string[];
  lists: readonly Stored<List>[];
  onClose: () => void;
  onAdded: (listId: string) => void;
}) {
  const [listId, setListId] = useState((pickShoppingTarget(lists) ?? lists[0]!).id);
  const list = lists.find((l) => l.id === listId) ?? lists[0]!;

  function add() {
    const message = t.lists.sharedAdded(entries.length, list.name);
    void undoableWithToast(message, message, async () => {
      for (const text of entries) await addItem(list.id, text, list.kind);
    });
    // Close first (drops `?share`), then show the list: the second address change wins.
    onClose();
    onAdded(list.id);
  }

  return (
    <>
      <SelectField
        label={t.lists.itemList}
        value={listId}
        onChange={(e) => setListId(e.target.value)}
        data-autofocus
      >
        {lists.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </SelectField>
      <p className={styles.hint}>{t.lists.sharedPreview(entries.length)}</p>
      <ul className={styles.preview} data-testid="lists-share-preview">
        {entries.slice(0, 8).map((e, i) => (
          <li key={i}>{e}</li>
        ))}
        {entries.length > 8 ? <li>{t.lists.sharedMore(entries.length - 8)}</li> : null}
      </ul>
      <FormActions>
        <Button onClick={onClose}>{t.actions.cancel}</Button>
        <Button variant="primary" onClick={add}>
          {t.actions.add}
        </Button>
      </FormActions>
    </>
  );
}
