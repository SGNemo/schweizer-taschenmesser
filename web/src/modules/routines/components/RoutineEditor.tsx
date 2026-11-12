import { useState } from 'react';
import { RecurrenceEditor } from '@/core/recurrence/RecurrenceEditor';
import type { Recurrence } from '@/core/recurrence/types';
import { today } from '@/core/time/dates';
import { deleteWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import {
  AdvancedFields,
  Button,
  DayField,
  Dialog,
  Form,
  FormActions,
  TextArea,
  TextField,
} from '@/ui';
import { firstDue, openEnded, parsePeople, type StoredRoutine } from '../logic';
import { routineRepo } from '../repo';

export type RoutineTarget = StoredRoutine | { draft: true } | null;

/** The rule of a new routine: every week, from today. */
const WEEKLY: Recurrence = { freq: 'weekly', interval: 1 };

export function RoutineEditor({
  target,
  rooms,
  onClose,
}: {
  target: RoutineTarget;
  /** Rooms already in use, offered as suggestions. */
  rooms: readonly string[];
  onClose: () => void;
}) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={existing ? t.routines.edit : t.routines.add}
      askAfterTyping
    >
      {target ? (
        <Fields key={existing?.id ?? 'new'} existing={existing} rooms={rooms} onClose={onClose} />
      ) : null}
    </Dialog>
  );
}

function Fields({
  existing,
  rooms,
  onClose,
}: {
  existing: StoredRoutine | null;
  rooms: readonly string[];
  onClose: () => void;
}) {
  const day = today();
  const [name, setName] = useState(existing?.name ?? '');
  const [room, setRoom] = useState(existing?.room ?? '');
  const [repeat, setRepeat] = useState<Recurrence>(existing?.repeat ?? WEEKLY);
  const [people, setPeople] = useState((existing?.people ?? []).join(', '));
  // "Nächstes Mal": the day it is due next. A new routine starts today.
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? day);
  const [minutes, setMinutes] = useState(existing?.minutes ? String(existing.minutes) : '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState('');

  async function save() {
    if (!name.trim()) return setError(t.form.required);
    const names = parsePeople(people);
    const rule = openEnded(repeat);
    const mins = Math.round(Number(minutes.replace(',', '.')));
    // The rule counts from the day the user set as the next one; a day in the past moves on to the rule's next.
    const startDate = dueDate || day;
    const data = {
      name: name.trim(),
      room: room.trim() || undefined,
      repeat: rule,
      startDate,
      dueDate: firstDue({ repeat: rule, startDate }, day),
      people: names,
      // Whoever was next stays next while their name is still there.
      turn: existing
        ? Math.max(
            0,
            names.indexOf(existing.people[existing.turn % (existing.people.length || 1)] ?? ''),
          )
        : 0,
      minutes: Number.isFinite(mins) && mins >= 1 ? Math.min(1440, mins) : undefined,
      note: note.trim() || undefined,
    };
    if (existing) await routineRepo.update(existing.id, data);
    else await routineRepo.create(data);
    onClose();
  }

  return (
    <Form onSubmit={() => void save()}>
      <TextField
        label={t.routines.fields.name}
        placeholder={t.routines.fields.namePlaceholder}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError('');
        }}
        error={error}
        data-autofocus
      />
      <TextField
        label={t.routines.fields.room}
        value={room}
        onChange={(e) => setRoom(e.target.value)}
        list="routines-rooms"
        autoComplete="off"
      />
      <datalist id="routines-rooms">
        {rooms.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      <RecurrenceEditor
        value={repeat}
        onChange={(next) => setRepeat(next ?? WEEKLY)}
        startDate={dueDate || day}
        required
        noEnd
      />
      <AdvancedFields
        moduleId="routines"
        hasData={
          !!existing && (existing.people.length > 0 || !!existing.minutes || !!existing.note)
        }
        summary={t.routines.fields.moreSummary}
      >
        <TextField
          label={t.routines.fields.people}
          hint={t.routines.fields.peopleHint}
          value={people}
          onChange={(e) => setPeople(e.target.value)}
          autoComplete="off"
        />
        <DayField
          label={t.routines.fields.dueDate}
          value={dueDate}
          onChange={setDueDate}
          required
        />
        <TextField
          label={t.routines.fields.minutes}
          inputMode="numeric"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
        />
        <TextArea
          label={t.form.note}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </AdvancedFields>
      <FormActions
        start={
          existing ? (
            <Button
              variant="quietDanger"
              onClick={() => {
                void deleteWithUndo(() => routineRepo.remove(existing.id));
                onClose();
              }}
            >
              {t.actions.delete}
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
