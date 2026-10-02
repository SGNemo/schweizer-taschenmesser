import { useState, type FormEvent } from 'react';
import { mapsUrl } from '@/core/links';
import { getPlatform } from '@/core/platform';
import type { Stored } from '@/core/db/types';
import { RecurrenceEditor } from '@/core/recurrence/RecurrenceEditor';
import type { Recurrence } from '@/core/recurrence/types';
import { t } from '@/strings';
import {
  Button,
  Dialog,
  Icon,
  patternStyles,
  SelectField,
  Switch,
  TextArea,
  TextField,
} from '@/ui';
import { eventRepo } from '../repo';
import { eventSchema, type CalendarEvent, type EventKind } from '../schema';
import styles from '../routes/calendar.module.css';

export type EventTarget =
  | Stored<CalendarEvent>
  | { draft: { startDate: string; kind?: EventKind; startTime?: string } }
  | null;

/** Lead times offered in the editor, in minutes. */
export const NOTIFY_LEADS = [0, 5, 10, 15, 30, 60, 1440] as const;
const leadLabel = (m: number): string =>
  m === 0
    ? t.calendar.notify.atStart
    : m === 60
      ? t.calendar.notify.hour
      : m === 1440
        ? t.calendar.notify.day
        : t.calendar.notify.minutes(m);

export function EventEditor({ target, onClose }: { target: EventTarget; onClose: () => void }) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={
        isReminder(target)
          ? existing
            ? t.reminders.edit
            : t.reminders.add
          : existing
            ? t.calendar.editEvent
            : t.calendar.newEvent
      }
    >
      {target ? <Form key={existing?.id ?? 'new'} target={target} onClose={onClose} /> : null}
    </Dialog>
  );
}

const isReminder = (target: EventTarget): boolean =>
  !!target && ('id' in target ? target.kind === 'reminder' : target.draft.kind === 'reminder');

function Form({ target, onClose }: { target: NonNullable<EventTarget>; onClose: () => void }) {
  const existing = 'id' in target ? target : null;
  const kind: EventKind = isReminder(target) ? 'reminder' : 'event';
  const reminder = kind === 'reminder';
  const [title, setTitle] = useState(existing?.title ?? '');
  const [allDay, setAllDay] = useState(!reminder && (existing?.allDay ?? false));
  const [startDate, setStartDate] = useState(
    existing?.startDate ?? ('draft' in target ? target.draft.startDate : ''),
  );
  const [startTime, setStartTime] = useState(
    existing?.startTime ??
      ('draft' in target && target.draft.startTime
        ? target.draft.startTime
        : existing
          ? ''
          : '09:00'),
  );
  const [endDate, setEndDate] = useState(existing?.endDate ?? '');
  const [endTime, setEndTime] = useState(existing?.endTime ?? '');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [recurrence, setRecurrence] = useState<Recurrence | undefined>(existing?.recurrence);
  const [notifyChoice, setNotifyChoice] = useState<string>(
    existing?.notify?.enabled || (reminder && !existing)
      ? String(existing?.notify?.minutesBefore ?? 0)
      : existing?.notify && reminder
        ? String(existing.notify.minutesBefore)
        : 'none',
  );
  const [active, setActive] = useState(existing?.notify?.enabled ?? true);
  const [error, setError] = useState('');

  async function save(e: FormEvent) {
    e.preventDefault();
    const lead = notifyChoice === 'none' ? undefined : Number(notifyChoice);
    const data = {
      title: title.trim(),
      kind,
      allDay,
      startDate,
      startTime: allDay ? undefined : startTime || undefined,
      endDate: endDate || undefined,
      endTime: allDay ? undefined : endTime || undefined,
      location: location.trim() || undefined,
      note: note.trim() || undefined,
      recurrence,
      notify:
        lead === undefined ? undefined : { minutesBefore: lead, enabled: reminder ? active : true },
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
      {reminder ? null : <Switch label={t.calendar.allDay} checked={allDay} onChange={setAllDay} />}
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
      {reminder ? null : (
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
      )}
      {reminder ? null : (
        <TextField
          label={t.calendar.location}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      )}
      {!reminder && location.trim() ? (
        <div>
          <Button variant="ghost" onClick={() => void getPlatform().app.openUrl(mapsUrl(location))}>
            <Icon name="pin" size={16} />
            {t.calendar.showOnMap}
          </Button>
        </div>
      ) : null}
      <RecurrenceEditor value={recurrence} onChange={setRecurrence} startDate={startDate} />
      <SelectField
        label={t.calendar.notify.label}
        value={notifyChoice}
        onChange={(e) => setNotifyChoice(e.target.value)}
      >
        {reminder ? null : <option value="none">{t.calendar.notify.none}</option>}
        {NOTIFY_LEADS.map((m) => (
          <option key={m} value={m}>
            {leadLabel(m)}
          </option>
        ))}
      </SelectField>
      {reminder ? (
        <Switch label={t.reminders.active} checked={active} onChange={setActive} />
      ) : null}
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
        <span className={patternStyles.hstack}>
          <Button onClick={onClose}>{t.actions.cancel}</Button>
          <Button type="submit" variant="primary">
            {t.actions.save}
          </Button>
        </span>
      </div>
    </form>
  );
}
