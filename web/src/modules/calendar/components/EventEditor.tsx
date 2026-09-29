import { useState, type FormEvent } from 'react';
import type { Stored } from '@/core/db/types';
import { RecurrenceEditor } from '@/core/recurrence/RecurrenceEditor';
import type { Recurrence } from '@/core/recurrence/types';
import { t } from '@/strings';
import { Button, Dialog, Switch, TextArea, TextField } from '@/ui';
import { eventRepo } from '../repo';
import { eventSchema, type CalendarEvent } from '../schema';
import styles from '../routes/calendar.module.css';

export type EventTarget = Stored<CalendarEvent> | { draft: { startDate: string } } | null;

export function EventEditor({ target, onClose }: { target: EventTarget; onClose: () => void }) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={existing ? t.calendar.editEvent : t.calendar.newEvent}
    >
      {target ? <Form key={existing?.id ?? 'new'} target={target} onClose={onClose} /> : null}
    </Dialog>
  );
}

function Form({ target, onClose }: { target: NonNullable<EventTarget>; onClose: () => void }) {
  const existing = 'id' in target ? target : null;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [allDay, setAllDay] = useState(existing?.allDay ?? false);
  const [startDate, setStartDate] = useState(
    existing?.startDate ?? ('draft' in target ? target.draft.startDate : ''),
  );
  const [startTime, setStartTime] = useState(existing?.startTime ?? (existing ? '' : '09:00'));
  const [endDate, setEndDate] = useState(existing?.endDate ?? '');
  const [endTime, setEndTime] = useState(existing?.endTime ?? '');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [recurrence, setRecurrence] = useState<Recurrence | undefined>(existing?.recurrence);
  const [error, setError] = useState('');

  async function save(e: FormEvent) {
    e.preventDefault();
    const data = {
      title: title.trim(),
      allDay,
      startDate,
      startTime: allDay ? undefined : startTime || undefined,
      endDate: endDate || undefined,
      endTime: allDay ? undefined : endTime || undefined,
      location: location.trim() || undefined,
      note: note.trim() || undefined,
      recurrence,
    };
    const parsed = eventSchema.safeParse(data);
    if (!parsed.success) {
      const path = parsed.error.issues[0]?.path[0];
      setError(
        path === 'endDate' || path === 'endTime' ? t.calendar.endBeforeStart : t.errors.generic,
      );
      return;
    }
    if (existing) await eventRepo.update(existing.id, data);
    else await eventRepo.create(data);
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
      <Switch label={t.calendar.allDay} checked={allDay} onChange={setAllDay} />
      <div className={styles.split}>
        <TextField
          label={t.form.date}
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
        />
        {allDay ? null : (
          <TextField
            label={t.calendar.start}
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        )}
      </div>
      <div className={styles.split}>
        <TextField
          label={`${t.calendar.end} (${t.form.date})`}
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        {allDay ? null : (
          <TextField
            label={`${t.calendar.end} (${t.form.time})`}
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        )}
      </div>
      <TextField
        label={t.calendar.location}
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />
      <RecurrenceEditor value={recurrence} onChange={setRecurrence} startDate={startDate} />
      <TextArea label={t.form.note} value={note} onChange={(e) => setNote(e.target.value)} />
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      <div className={styles.actions}>
        {existing ? (
          <Button
            variant="danger"
            onClick={async () => {
              await eventRepo.remove(existing.id);
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
