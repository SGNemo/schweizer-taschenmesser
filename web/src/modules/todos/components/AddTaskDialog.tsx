import { useState } from 'react';
import { t } from '@/strings';
import { Button, Dialog, Form, FormActions, TextField } from '@/ui';

/**
 * The page's one entry for a new task (Identity 4.0, rule 4): the head's action (or the plus on the phone) opens it,
 * the title has the focus, Enter saves. One field on purpose: date, time and priority can be typed into the title
 * ("morgen 15 min Steuer"), everything else is in the task's editor.
 */
export function AddTaskDialog({
  open,
  initialTitle = '',
  ready = true,
  onAdd,
  onClose,
}: {
  open: boolean;
  /** A shared title (`/todos?new=1&title=…`). */
  initialTitle?: string;
  /** False until there is a list to add to (a fresh installation creates its inbox first): saving waits for it. */
  ready?: boolean;
  /** Saves the task; the dialog closes once it has settled. */
  onAdd: (title: string) => Promise<unknown>;
  onClose: () => void;
}) {
  // A new opening, or another shared title, starts with that title.
  const session = open ? initialTitle : null;
  const [seen, setSeen] = useState<string | null>(null);
  const [title, setTitle] = useState(initialTitle);
  if (session !== seen) {
    setSeen(session);
    setTitle(initialTitle);
  }
  return (
    // Text in the field, typed or shared, is never dropped without a question (Esc, a tap beside the sheet,
    // Back); an empty field closes at once. Saving and "Abbrechen" are explicit and close directly.
    <Dialog
      open={open}
      onClose={onClose}
      title={t.todos.newTask}
      dirty={open && title.trim() !== ''}
    >
      {open ? (
        <Form
          onSubmit={async () => {
            if (!title.trim() || !ready) return;
            await onAdd(title);
            onClose();
          }}
        >
          <TextField
            label={t.form.title}
            placeholder={t.todos.addPlaceholder}
            hint={t.todos.addHint}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            data-autofocus
          />
          <FormActions>
            <Button onClick={onClose}>{t.actions.cancel}</Button>
            <Button type="submit" variant="primary" disabled={!ready}>
              {t.actions.add}
            </Button>
          </FormActions>
        </Form>
      ) : null}
    </Dialog>
  );
}
