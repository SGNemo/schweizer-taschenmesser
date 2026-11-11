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
  onAdd,
  onClose,
}: {
  open: boolean;
  /** A shared title (`/todos?new=1&title=…`). */
  initialTitle?: string;
  /** Saves the task; the dialog closes once it has settled. */
  onAdd: (title: string) => Promise<unknown>;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={t.todos.add}>
      {open ? <Body initialTitle={initialTitle} onAdd={onAdd} onClose={onClose} /> : null}
    </Dialog>
  );
}

function Body({
  initialTitle,
  onAdd,
  onClose,
}: {
  initialTitle: string;
  onAdd: (title: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  return (
    <Form
      onSubmit={async () => {
        if (!title.trim()) return;
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
        <Button type="submit" variant="primary">
          {t.actions.add}
        </Button>
      </FormActions>
    </Form>
  );
}
