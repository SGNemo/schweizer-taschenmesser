import { useSubmitOnce } from '@/core/forms/submitOnce';
import { changedFields } from '@/core/db/patch';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { bus } from '@/core/events';
import { mapsUrl } from '@/core/links';
import { useUiStore } from '@/stores/ui';
import { getPlatform } from '@/core/platform';
import type { Stored } from '@/core/db/types';
import { RecurrenceEditor } from '@/core/recurrence/RecurrenceEditor';
import type { Recurrence } from '@/core/recurrence/types';
import { copyData } from '@/core/db/copy';
import { PersonField } from '@/core/people/PersonField';
import { addDaysStr, formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { tDraft } from '@/strings.draft';
import {
  AdvancedFields,
  Button,
  Checkbox,
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
import { useCalendars } from './CalendarsBar';
import { LeadRow, NOTIFY_LEADS, leadLabel } from './LeadRow';
import { eventSchema, type CalendarEvent, type EventKind } from '../schema';
import styles from '../routes/calendar.module.css';
import { changeWithUndo, deleteWithUndo, undoableWithToast } from '@/core/undo/withToast';

export type EventTarget =
  | Stored<CalendarEvent>
  | { draft: { startDate: string; kind?: EventKind; startTime?: string; endTime?: string } }
  | null;

export { NOTIFY_LEADS } from './LeadRow';

export function EventEditor({
  target,
  onClose,
  onDuplicated,
  occurrence,
}: {
  target: EventTarget;
  onClose: () => void;
  /** The occurrence date the entry was opened from (recurring events: "only this one"). */
  occurrence?: string | null;
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
          occurrence={occurrence ?? undefined}
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
  occurrence,
}: {
  target: NonNullable<EventTarget>;
  onClose: () => void;
  occurrence?: string;
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
    endTime: existing?.endTime ?? ('draft' in target ? (target.draft.endTime ?? '') : ''),
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
    calendarId: existing?.calendarId ?? '',
    extra: (existing?.notify?.extraMinutes ?? []).map(String),
  });
  const { title, allDay, startDate, startTime, endDate, endTime, location, note, personId } =
    draft.values;
  const { recurrence, notifyChoice, active, taken, calendarId, extra } = draft.values;
  const calendars = useCalendars();
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
  // The record as the editor opened it: only fields that differ from it are saved (QA X01).
  const [opened] = useState(existing);
  const [error, setError] = useState('');
  const navigate = useNavigate();
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
      calendarId: !reminder && calendarId ? calendarId : undefined,
      taken: reminder && taken ? true : undefined,
      notify:
        lead === undefined
          ? undefined
          : {
              minutesBefore: lead,
              enabled: reminder ? active : true,
              ...(!reminder && extra.length
                ? { extraMinutes: extra.map(Number).filter((m) => m !== lead) }
                : {}),
            },
    };
    const parsed = eventSchema.safeParse(data);
    if (!parsed.success) {
      const path = parsed.error.issues[0]?.path[0];
      setError(
        path === 'endDate' || path === 'endTime' ? t.calendar.endBeforeStart : t.errors.generic,
      );
      return;
    }
    if (existing) await eventRepo.update(existing.id, changedFields(opened ?? existing, data));
    else await eventRepo.create(data);
    draft.clear();
    onClose();
  }
  const cancel = () => {
    draft.clear();
    onClose();
  };

  // One save per submit: a double click or Enter + click never saves twice (QA X13).
  const saveOnce = useSubmitOnce(save);
  return (
    <form onSubmit={saveOnce} className={styles.form}>
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
              className={styles.recentChip}
              aria-label={`${s.title} ${s.startTime}–${s.endTime}`}
              title={s.title}
              onClick={() => {
                setTitle(s.title);
                setStartTime(s.startTime);
                setEndTime(s.endTime);
              }}
            >
              {/* One title line with an ellipsis, the time as a meta line below (U27a). */}
              <span className={styles.recentTitle}>{s.title}</span>
              <span className={styles.recentTime}>{`${s.startTime}–${s.endTime}`}</span>
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
          <Button
            variant="ghost"
            onClick={() => {
              onClose();
              void navigate(`/maps?q=${encodeURIComponent(location.trim())}`);
            }}
          >
            <Icon name="pin" size={16} />
            {t.calendar.saveAsPlace}
          </Button>
        </div>
      ) : null}
      {!reminder && calendars && calendars.length > 0 ? (
        <SelectField
          label={t.calendar.calendars.field}
          value={calendarId}
          onChange={(e) => draft.set('calendarId', e.target.value)}
        >
          <option value="">{t.calendar.calendars.none}</option>
          {calendars.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
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
      <AdvancedFields moduleId="calendar" hasData={!!endDate || !!note || extra.length > 0}>
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
        {!reminder && notifyChoice !== 'none' && (allDay || startTime) ? (
          <fieldset className={styles.extraLeads}>
            <legend>{t.calendar.notify.extra}</legend>
            {NOTIFY_LEADS.filter((m) => String(m) !== notifyChoice).map((m) => (
              <Checkbox
                key={m}
                label={leadLabel(m)}
                checked={extra.includes(String(m))}
                onChange={(e) =>
                  draft.set(
                    'extra',
                    e.target.checked ? [...extra, String(m)] : extra.filter((x) => x !== String(m)),
                  )
                }
              />
            ))}
          </fieldset>
        ) : null}
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
          {existing && !reminder ? (
            <Button
              variant="ghost"
              onClick={async () => {
                await bus.emit('todo.requested', {
                  title: existing.title,
                  dueDate: occurrence ?? existing.startDate,
                  link: { kind: 'event', id: existing.id, label: existing.title },
                  ...(existing.note ? { note: existing.note } : {}),
                });
                useUiStore.getState().toast(t.calendar.asTodoDone);
              }}
            >
              {t.calendar.asTodo}
            </Button>
          ) : null}
          {existing && !reminder ? (
            <Button
              variant="ghost"
              onClick={async () => {
                // Time tracking starts the clock when it is on (it listens to this event); the event only names it.
                await bus.emit('timetrack.start.requested', {
                  title: existing.title,
                  sourceRef: existing.id,
                });
              }}
            >
              {t.timetrack.fromEvent.action}
            </Button>
          ) : null}
          {existing?.recurrence && occurrence ? (
            <Button
              variant="ghost"
              onClick={async () => {
                const skipped = [...new Set([...(existing.exdates ?? []), occurrence])].sort();
                await changeWithUndo(() => eventRepo.update(existing.id, { exdates: skipped }));
                draft.clear();
                onClose();
              }}
            >
              {t.calendar.skipOccurrence(formatDay(occurrence, 'd. MMM'))}
            </Button>
          ) : null}
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
