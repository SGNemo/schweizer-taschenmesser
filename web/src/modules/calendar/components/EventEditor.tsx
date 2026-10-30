import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { mapsUrl } from '@/core/links';
import { getPlatform } from '@/core/platform';
import type { Stored } from '@/core/db/types';
import { RecurrenceEditor } from '@/core/recurrence/RecurrenceEditor';
import type { Recurrence } from '@/core/recurrence/types';
import { copyData } from '@/core/db/copy';
import { PersonField } from '@/core/people/PersonField';
import { addDaysStr } from '@/core/time/dates';
import { t } from '@/strings';
import { tDraft } from '@/strings.draft';
import {
  AdvancedFields,
  Button,
  DateChips,
  Dialog,
  Icon,
  SelectField,
  Switch,
  TextArea,
  TextField,
  patternStyles,
  useFormDraft,
} from '@/ui';
import { recentSlots } from '../recentSlots';
import { eventRepo } from '../repo';
import { LeadRow, NOTIFY_LEADS, leadLabel } from './LeadRow';
import { eventSchema, type CalendarEvent, type EventKind } from '../schema';
import styles from '../routes/calendar.module.css';
import { deleteWithUndo, undoableWithToast } from '@/core/undo/withToast';

export type EventTarget =
  | Stored<CalendarEvent>
  | { draft: { startDate: string; kind?: EventKind; startTime?: string } }
  | null;

export { NOTIFY_LEADS } from './LeadRow';

export function EventEditor({
  target,
  onClose,
  onDuplicated,
}: {
  target: EventTarget;
  onClose: () => void;
  /** The copy made by "Duplizieren"; the page opens it for editing. */
  onDuplicated?: (copy: Stored<CalendarEvent>) => void;
}) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={
        isReminder(target)
          ? existing
            ? t.calendar.reminders.edit
            : t.calendar.reminders.add
          : existing
            ? t.calendar.editEvent
            : t.calendar.newEvent
      }
    >
      {target ? (
        <Form
          key={existing?.id ?? 'new'}
          target={target}
          onClose={onClose}
          onDuplicated={onDuplicated}
        />
      ) : null}
    </Dialog>
  );
}

const isReminder = (target: EventTarget): boolean =>
  !!target && ('id' in target ? target.kind === 'reminder' : target.draft.kind === 'reminder');

function Form({
  target,
  onClose,
  onDuplicated,
}: {
  target: NonNullable<EventTarget>;
  onClose: () => void;
  onDuplicated?: (copy: Stored<CalendarEvent>) => void;
}) {
  const existing = 'id' in target ? target : null;
  const kind: EventKind = isReminder(target) ? 'reminder' : 'event';
  const reminder = kind === 'reminder';
  // Typed text survives Esc or a tap beside the dialog (memory only, 30 minutes); saving and
  // "Abbrechen" drop it. A new entry from another day starts with its own draft.
  const dr = tDraft.use();
  const startDay = existing?.startDate ?? ('draft' in target ? target.draft.startDate : '');
  const draft = useFormDraft(`calendar:event:${existing?.id ?? `new:${kind}:${startDay}`}`, {
    title: existing?.title ?? '',
    allDay: !reminder && (existing?.allDay ?? false),
    startDate: startDay,
    startTime:
      existing?.startTime ??
      ('draft' in target && target.draft.startTime
        ? target.draft.startTime
        : existing
          ? ''
          : '09:00'),
    endDate: existing?.endDate ?? '',
    endTime: existing?.endTime ?? '',
    location: existing?.location ?? '',
    note: existing?.note ?? '',
    personId: existing?.personId ?? '',
    recurrence: existing?.recurrence as Recurrence | undefined,
    notifyChoice: (existing?.notify?.enabled || (reminder && !existing)
      ? String(existing?.notify?.minutesBefore ?? 0)
      : existing?.notify && reminder
        ? String(existing.notify.minutesBefore)
        : 'none') as string,
    active: existing?.notify?.enabled ?? true,
    taken: existing?.taken ?? false,
  });
  const { title, allDay, startDate, startTime, endDate, endTime, location, note, personId } =
    draft.values;
  const { recurrence, notifyChoice, active, taken } = draft.values;
  const setTitle = (v: string) => draft.set('title', v);
  const setAllDay = (v: boolean) => draft.set('allDay', v);
  const setStartDate = (v: string) => draft.set('startDate', v);
  const setStartTime = (v: string) => draft.set('startTime', v);
  const setEndDate = (v: string) => draft.set('endDate', v);
  const setEndTime = (v: string) => draft.set('endTime', v);
  const setLocation = (v: string) => draft.set('location', v);
  const setNote = (v: string) => draft.set('note', v);
  const setPersonId = (v: string) => draft.set('personId', v);
  const setRecurrence = (v: Recurrence | undefined) => draft.set('recurrence', v);
  const setNotifyChoice = (v: string) => draft.set('notifyChoice', v);
  const setActive = (v: boolean) => draft.set('active', v);
  const setTaken = (v: boolean) => draft.set('taken', v);
  const [error, setError] = useState('');
  // Shifts and other fixed slots from earlier entries: one tap fills title, start and end.
  const slots = useLiveQuery(
    async () => (existing || reminder ? [] : recentSlots(await eventRepo.active().toArray())),
    [existing, reminder],
  );

  async function save(e: FormEvent) {
    e.preventDefault();
    const lead = notifyChoice === 'none' ? undefined : Number(notifyChoice);
    // "21:30 to 06:30" ends on the next day; the schema wants that said explicitly.
    const overnight =
      !allDay && !reminder && !endDate && !!startTime && !!endTime && endTime < startTime;
    const data = {
      title: title.trim(),
      kind,
      allDay,
      startDate,
      startTime: allDay ? undefined : startTime || undefined,
      endDate: overnight ? addDaysStr(startDate, 1) : endDate || undefined,
      endTime: allDay ? undefined : endTime || undefined,
      location: location.trim() || undefined,
      note: note.trim() || undefined,
      personId: personId || undefined,
      recurrence,
      taken: reminder && taken ? true : undefined,
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
    draft.clear();
    onClose();
  }
  const cancel = () => {
    draft.clear();
    onClose();
  };

  return (
    <form onSubmit={save} className={styles.form}>
      {draft.restored ? (
        <p role="status" data-testid="draft-restored">
          {dr.restored}{' '}
          <Button variant="ghost" onClick={draft.discard}>
            {dr.discard}
          </Button>
        </p>
      ) : null}
      {slots && slots.length > 0 ? (
        <div className={patternStyles.hstack} role="group" aria-label={t.calendar.recent}>
          {slots.map((s) => (
            <Button
              key={`${s.title}|${s.startTime}|${s.endTime}`}
              variant="secondary"
              onClick={() => {
                setTitle(s.title);
                setStartTime(s.startTime);
                setEndTime(s.endTime);
              }}
            >
              {`${s.title} ${s.startTime}–${s.endTime}`}
            </Button>
          ))}
        </div>
      ) : null}
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
        {allDay || reminder ? null : (
          <TextField
            label={t.calendar.end}
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        )}
      </div>
      <DateChips
        value={startDate}
        onChange={(d) => {
          setStartDate(d);
          if (endDate && endDate < d) setEndDate(d);
        }}
      />
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
      <PersonField value={personId} onChange={setPersonId} />
      {!reminder && !allDay && startTime ? (
        <LeadRow
          value={notifyChoice}
          onChange={setNotifyChoice}
          isNew={!existing && !draft.restored}
        />
      ) : (
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
      )}
      {reminder ? (
        <Switch label={t.calendar.reminders.active} checked={active} onChange={setActive} />
      ) : null}
      {reminder ? (
        <Switch label={t.calendar.reminders.intake} checked={taken} onChange={setTaken} />
      ) : null}
      <AdvancedFields moduleId="calendar" hasData={!!endDate || !!note}>
        {reminder ? null : (
          <div className={styles.split}>
            <TextField
              label={`${t.calendar.end} (${t.form.date})`}
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        )}
        <TextArea label={t.form.note} value={note} onChange={(e) => setNote(e.target.value)} />
      </AdvancedFields>
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
              await deleteWithUndo(() => eventRepo.remove(existing.id));
              draft.clear();
              onClose();
            }}
          >
            {t.actions.delete}
          </Button>
        ) : (
          <span />
        )}
        <span className={patternStyles.hstack}>
          {existing ? (
            <Button
              variant="ghost"
              onClick={async () => {
                const copy = await undoableWithToast(
                  t.actions.duplicated,
                  t.actions.duplicated,
                  () => eventRepo.create(copyData(existing)),
                );
                draft.clear();
                onClose();
                onDuplicated?.(copy);
              }}
            >
              {t.actions.duplicate}
            </Button>
          ) : null}
          <Button onClick={cancel}>{t.actions.cancel}</Button>
          <Button type="submit" variant="primary">
            {t.actions.save}
          </Button>
        </span>
      </div>
    </form>
  );
}
