import { useState, type FormEvent } from 'react';
import type { Stored } from '@/core/db/types';
import { RecurrenceEditor } from '@/core/recurrence/RecurrenceEditor';
import type { Recurrence } from '@/core/recurrence/types';
import { t } from '@/strings';
import { Button, Dialog, Switch, TextArea, TextField } from '@/ui';
import { reminderRepo } from '../repo';
import type { Reminder } from '../schema';
import styles from '../routes/reminders.module.css';

export type EditorTarget = Stored<Reminder> | { draft: { startDate: string; time: string } } | null;

export function ReminderEditor({ target, onClose }: { target: EditorTarget; onClose: () => void }) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={existing ? t.reminders.edit : t.reminders.add}
    >
      {target ? <Form key={existing?.id ?? 'new'} target={target} onClose={onClose} /> : null}
    </Dialog>
  );
}

function Form({ target, onClose }: { target: NonNullable<EditorTarget>; onClose: () => void }) {
  const existing = 'id' in target ? target : null;
  const draft = 'draft' in target ? target.draft : null;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [startDate, setStartDate] = useState(existing?.startDate ?? draft?.startDate ?? '');
  const [time, setTime] = useState(existing?.time ?? draft?.time ?? '09:00');
  const [recurrence, setRecurrence] = useState<Recurrence | undefined>(existing?.recurrence);
  const [active, setActive] = useState(existing?.active ?? true);

  async function save(e: FormEvent) {
    e.preventDefault();
    const value = title.trim();
    if (!value || !startDate) return;
    const data = {
      title: value,
      note: note.trim() || undefined,
      startDate,
      time,
      recurrence,
      active,
    };
    if (existing) await reminderRepo.update(existing.id, data);
    else await reminderRepo.create(data);
    onClose();
  }

  return (
    <form onSubmit={save} className={styles.form}>
      <TextField
        label={t.form.title}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        data-autofocus
      />
      <div className={styles.split}>
        <TextField
          label={t.reminders.firstDate}
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
        />
        <TextField
          label={t.form.time}
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          required
        />
      </div>
      <RecurrenceEditor value={recurrence} onChange={setRecurrence} startDate={startDate} />
      <TextArea label={t.form.note} value={note} onChange={(e) => setNote(e.target.value)} />
      {existing ? (
        <Switch label={t.reminders.active} checked={active} onChange={setActive} />
      ) : null}
      <div className={styles.actions}>
        {existing ? (
          <Button
            variant="danger"
            onClick={async () => {
              await reminderRepo.remove(existing.id);
              onClose();
            }}
          >
            {t.actions.delete}
          </Button>
        ) : (
          <span />
        )}
        <span style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button onClick={onClose}>{t.actions.cancel}</Button>
          <Button type="submit" variant="primary">
            {t.actions.save}
          </Button>
        </span>
      </div>
    </form>
  );
}
