import { changedFields } from '@/core/db/patch';
import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { deleteWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import { Button, categoryColor, Dialog, Form, FormActions, Icon, TextField } from '@/ui';
import type { IconName } from '@/ui/icons';
import { NOTEBOOK_ICONS, nextNotebookOrder } from '../logic';
import { noteRepo, notebookRepo } from '../repo';
import type { Notebook } from '../schema';
import styles from './Dialogs.module.css';

/** Create or edit a notebook: name, colour (always next to the name in the list) and icon. */
export function NotebookDialog({
  open,
  notebook,
  books,
  pageIds,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** `null` = a new notebook. */
  notebook: Stored<Notebook> | null;
  books: readonly Notebook[];
  /** Ids of the pages in this notebook; they move to "Allgemein" when it is deleted. */
  pageIds: readonly string[];
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      askAfterTyping
      title={notebook ? t.notes.editNotebook : t.notes.newNotebook}
    >
      {open ? (
        <Fields
          key={notebook?.id ?? 'new'}
          notebook={notebook}
          books={books}
          pageIds={pageIds}
          onClose={onClose}
          onSaved={onSaved}
        />
      ) : null}
    </Dialog>
  );
}

function Fields({
  notebook,
  books,
  pageIds,
  onClose,
  onSaved,
}: {
  notebook: Stored<Notebook> | null;
  books: readonly Notebook[];
  pageIds: readonly string[];
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  // The record as the editor opened it: only fields that differ from it are saved (QA X01).
  const [opened] = useState(notebook);
  const [name, setName] = useState(notebook?.name ?? '');
  const [tone, setTone] = useState(notebook?.tone ?? books.length % 6);
  const [icon, setIcon] = useState(notebook?.icon ?? 'note');
  const [error, setError] = useState('');

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return setError(t.form.required);
    if (notebook) {
      await notebookRepo.update(
        notebook.id,
        changedFields(opened ?? notebook, { name: trimmed, tone, icon }),
      );
      onSaved(notebook.id);
    } else {
      const created = await notebookRepo.create({
        name: trimmed,
        tone,
        icon,
        order: nextNotebookOrder(books),
      });
      onSaved(created.id);
    }
    onClose();
  }

  return (
    <Form onSubmit={save}>
      <TextField
        label={t.notes.notebookName}
        value={name}
        error={error}
        onChange={(e) => {
          setName(e.target.value);
          setError('');
        }}
        data-autofocus
      />
      <div className={styles.field} role="group" aria-label={t.notes.notebookColour}>
        <span className={styles.legend}>{t.notes.notebookColour}</span>
        <div className={styles.swatches}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              className={styles.swatch}
              aria-pressed={tone === i}
              aria-label={t.notes.colourN(i + 1)}
              title={t.notes.colourN(i + 1)}
              onClick={() => setTone(i)}
            >
              <span className={styles.swatchDot} style={{ background: categoryColor(i) }} />
            </button>
          ))}
        </div>
      </div>
      <div className={styles.field} role="group" aria-label={t.notes.notebookIcon}>
        <span className={styles.legend}>{t.notes.notebookIcon}</span>
        <div className={styles.icons}>
          {NOTEBOOK_ICONS.map((name) => (
            <button
              key={name}
              type="button"
              className={styles.iconBtn}
              aria-pressed={icon === name}
              aria-label={t.notes.iconNames[name]}
              title={t.notes.iconNames[name]}
              onClick={() => setIcon(name)}
            >
              <Icon name={name as IconName} size={20} />
            </button>
          ))}
        </div>
      </div>
      {notebook ? <p className={styles.trashMeta}>{t.notes.notebookDeleteHint}</p> : null}
      <FormActions
        start={
          notebook ? (
            <Button
              variant="danger"
              onClick={async () => {
                await deleteWithUndo(async () => {
                  for (const id of pageIds) await noteRepo.update(id, { notebookId: null });
                  await notebookRepo.remove(notebook.id);
                });
                onClose();
              }}
            >
              {t.notes.notebookDelete}
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
