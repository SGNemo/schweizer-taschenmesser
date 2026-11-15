import { useId, useState } from 'react';
import { useModuleStates } from '@/core/modules/activation';
import { weekdayShort } from '@/core/recurrence/describe';
import { RecurrenceEditor } from '@/core/recurrence/RecurrenceEditor';
import type { Recurrence } from '@/core/recurrence/types';
import { today } from '@/core/time/dates';
import { deleteWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import {
  AdvancedFields,
  Button,
  Checkbox,
  DayField,
  Dialog,
  Form,
  FormActions,
  Icon,
  SelectField,
  TextArea,
  TextField,
  TimeField,
} from '@/ui';
import {
  editPatch,
  newRoutine,
  parseSteps,
  RHYTHMS,
  rhythmOf,
  ruleOf,
  stepsOf,
  stepsText,
  WORKDAYS,
  type Rhythm,
  type StoredRoutine,
} from '../logic';
import { routineRepo } from '../repo';
import { DAYPARTS, type Daypart } from '../schema';
import { ROUTINE_START_IDS, ROUTINE_STARTS, type RoutineStartId } from '../starts';
import styles from './RoutineEditor.module.css';

/** A new routine (optionally filled from a start) or one to edit; null = closed. */
export type RoutineTarget = StoredRoutine | { draft: true; start?: RoutineStartId } | null;

/** The rule of a new routine: every week, from today. */
const WEEKLY: Recurrence = { freq: 'weekly', interval: 1 };

const newStepId = () => crypto.randomUUID().slice(0, 8);

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
  const start = target && 'draft' in target ? target.start : undefined;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={existing ? t.routines.edit : t.routines.add}
      askAfterTyping
    >
      {target ? (
        <Fields
          key={existing?.id ?? `new-${start ?? ''}`}
          existing={existing}
          start={start}
          rooms={rooms}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

function Fields({
  existing,
  start,
  rooms,
  onClose,
}: {
  existing: StoredRoutine | null;
  start?: RoutineStartId;
  rooms: readonly string[];
  onClose: () => void;
}) {
  const day = today();
  const initialRule = existing?.repeat ?? (start ? ROUTINE_STARTS[start].repeat : WEEKLY);
  const [chosen, setChosen] = useState<RoutineStartId | undefined>(start);
  const [name, setName] = useState(existing?.name ?? (start ? t.routines.starts[start].name : ''));
  const [room, setRoom] = useState(existing?.room ?? '');
  const [rhythm, setRhythm] = useState<Rhythm>(rhythmOf(initialRule));
  const [days, setDays] = useState<number[]>(initialRule.byWeekday ?? []);
  // The full rule, edited only under „Anders“.
  const [custom, setCustom] = useState<Recurrence>(initialRule);
  const [daypart, setDaypart] = useState<Daypart | undefined>(
    existing ? existing.daypart : start ? ROUTINE_STARTS[start].daypart : undefined,
  );
  const [steps, setSteps] = useState(
    existing
      ? stepsText(stepsOf(existing))
      : start
        ? t.routines.starts[start].steps.join('\n')
        : '',
  );
  const [people, setPeople] = useState((existing?.people ?? []).join(', '));
  // "Nächstes Mal": the day it is due next. A new routine starts today.
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? day);
  const [minutes, setMinutes] = useState(
    existing?.minutes
      ? String(existing.minutes)
      : start
        ? String(ROUTINE_STARTS[start].minutes)
        : '',
  );
  const [note, setNote] = useState(existing?.note ?? '');
  const [remindAt, setRemindAt] = useState(existing?.remindAt ?? '');
  const [planner, setPlanner] = useState(
    existing ? existing.planner !== false : start ? ROUTINE_STARTS[start].planner : true,
  );
  // „Im Planer zeigen“ only while the planner is on: without it the switch would do nothing visible.
  const plannerOn = useModuleStates()?.planner === true;
  const [error, setError] = useState('');

  /** A start fills the form; the name only when it is empty or still the name of another start. */
  function choose(id: RoutineStartId | undefined) {
    const startNames: string[] = ROUTINE_START_IDS.map((s) => t.routines.starts[s].name);
    const keepName = name.trim() !== '' && !startNames.includes(name.trim());
    const rule = id ? ROUTINE_STARTS[id].repeat : WEEKLY;
    setChosen(id);
    if (!keepName) setName(id ? t.routines.starts[id].name : '');
    setRhythm(rhythmOf(rule));
    setDays(rule.byWeekday ? [...rule.byWeekday] : []);
    setCustom(rule);
    setDaypart(id ? ROUTINE_STARTS[id].daypart : undefined);
    setSteps(id ? t.routines.starts[id].steps.join('\n') : '');
    setMinutes(id ? String(ROUTINE_STARTS[id].minutes) : '');
    setPlanner(id ? ROUTINE_STARTS[id].planner : true);
    setError('');
  }

  function toggleDay(wd: number) {
    const next = days.includes(wd) ? days.filter((d) => d !== wd) : [...days, wd];
    setDays(next.sort((a, b) => a - b));
  }

  function changeRhythm(next: Rhythm) {
    setRhythm(next);
    if (next === 'weekdays' && days.length === 0) setDays([...WORKDAYS]);
    // „Anders“ opens the full editor on the rule chosen so far.
    if (next === 'custom' && rhythm !== 'custom') setCustom(ruleOf(rhythm, days));
  }

  const last = days.length === 1 ? days[0] : undefined;
  const lastDayHintId = useId();

  const repeat: Recurrence =
    rhythm === 'custom' ? custom : ruleOf(rhythm, rhythm === 'weekdays' ? days : []);

  async function save() {
    if (!name.trim()) return setError(t.form.required);
    const mins = Math.round(Number(minutes.replace(',', '.')));
    // An emptied field clears the duration; text that is no number leaves it as it was.
    const duration =
      minutes.trim() === ''
        ? undefined
        : Number.isFinite(mins) && mins >= 1
          ? Math.min(1440, mins)
          : existing?.minutes;
    const form = {
      name,
      room,
      repeat,
      people,
      dueDate: dueDate || day,
      minutes: duration,
      note,
      steps: parseSteps(steps, existing ? stepsOf(existing) : [], newStepId),
      daypart,
      remindAt,
      planner,
    };
    if (existing) {
      // Only what was changed here is written (`editPatch`): a due routine stays due, a tick made meanwhile stays.
      const patch = editPatch(existing, form, (await routineRepo.get(existing.id)) ?? existing);
      if (Object.keys(patch).length > 0) await routineRepo.update(existing.id, patch);
    } else await routineRepo.create(newRoutine(form));
    onClose();
  }

  return (
    <Form onSubmit={() => void save()}>
      {existing ? null : (
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>{t.routines.starts.label}</legend>
          <div className={styles.chips}>
            {ROUTINE_START_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className={styles.chip}
                aria-pressed={chosen === id}
                onClick={() => choose(id)}
              >
                {chosen === id ? <Icon name="check" size={16} /> : null}
                {t.routines.starts[id].label}
              </button>
            ))}
            <button
              type="button"
              className={styles.chip}
              aria-pressed={chosen === undefined}
              onClick={() => choose(undefined)}
            >
              {chosen === undefined ? <Icon name="check" size={16} /> : null}
              {t.routines.starts.blank}
            </button>
          </div>
        </fieldset>
      )}
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
      <div className={styles.row}>
        <SelectField
          label={t.routines.fields.rhythm}
          value={rhythm}
          onChange={(e) => changeRhythm(e.target.value as Rhythm)}
        >
          {RHYTHMS.map((r) => (
            <option key={r} value={r}>
              {t.routines.fields.rhythms[r]}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t.routines.fields.daypart}
          value={daypart ?? ''}
          onChange={(e) => setDaypart((e.target.value || undefined) as Daypart | undefined)}
        >
          <option value="">{t.routines.fields.daypartAny}</option>
          {DAYPARTS.map((d) => (
            <option key={d} value={d}>
              {t.routines.fields.dayparts[d]}
            </option>
          ))}
        </SelectField>
      </div>
      {rhythm === 'weekdays' ? (
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>{t.routines.fields.days}</legend>
          <div className={styles.chips}>
            {[1, 2, 3, 4, 5, 6, 7].map((wd) => (
              <button
                key={wd}
                type="button"
                className={styles.chip}
                aria-pressed={days.includes(wd)}
                // The last day stays chosen (a routine without a day would never come round); it stays in the
                // tab order and says why it does not change.
                aria-disabled={last === wd || undefined}
                aria-describedby={last === wd ? lastDayHintId : undefined}
                onClick={() => (last === wd ? undefined : toggleDay(wd))}
              >
                {days.includes(wd) ? <Icon name="check" size={16} /> : null}
                {weekdayShort(wd)}
              </button>
            ))}
          </div>
          {last !== undefined ? (
            <span id={lastDayHintId} className={styles.hint}>
              {t.routines.fields.lastDay}
            </span>
          ) : null}
        </fieldset>
      ) : null}
      {rhythm === 'custom' ? (
        <RecurrenceEditor
          value={custom}
          onChange={(next) => setCustom(next ?? WEEKLY)}
          startDate={dueDate || day}
          required
          noEnd
        />
      ) : null}
      <TextArea
        label={t.routines.fields.steps}
        hint={t.routines.fields.stepsHint}
        rows={4}
        value={steps}
        onChange={(e) => setSteps(e.target.value)}
      />
      <TimeField
        label={t.routines.fields.remindAt}
        hint={t.routines.fields.remindAtHint}
        value={remindAt}
        onChange={setRemindAt}
      />
      {plannerOn ? (
        <Checkbox
          label={t.routines.fields.planner}
          description={t.routines.fields.plannerHint}
          checked={planner}
          onChange={(e) => setPlanner(e.target.checked)}
        />
      ) : null}
      <AdvancedFields
        moduleId="routines"
        hasData={
          !!existing &&
          (!!existing.room || existing.people.length > 0 || !!existing.minutes || !!existing.note)
        }
        summary={t.routines.fields.moreSummary}
      >
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
        <TextField
          label={t.routines.fields.people}
          hint={t.routines.fields.peopleHint}
          value={people}
          onChange={(e) => setPeople(e.target.value)}
          autoComplete="off"
        />
        <DayField
          label={t.routines.fields.dueDate}
          hint={dueDate < day ? t.routines.fields.dueDatePast : undefined}
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
          {existing ? t.actions.save : t.routines.add}
        </Button>
      </FormActions>
    </Form>
  );
}
