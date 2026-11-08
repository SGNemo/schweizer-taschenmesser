import { useState } from 'react';
import { changedFields } from '@/core/db/patch';
import type { Stored } from '@/core/db/types';
import { nowTime, today } from '@/core/time/dates';
import { deleteWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import {
  AdvancedFields,
  Button,
  Checkbox,
  Dialog,
  Form,
  FormActions,
  Icon,
  IconButton,
  TextField,
} from '@/ui';
import { builtInExercises } from '../data';
import { exerciseSuggestions, lastOf, toTemplate } from '../logic';
import { sessionRepo, templateRepo } from '../repo';
import {
  sessionSchema,
  templateSchema,
  type Exercise,
  type Session,
  type Template,
} from '../schema';
import styles from '../fitness.module.css';

export type SessionTarget = Stored<Session> | 'new' | null;

interface Row {
  key: number;
  name: string;
  sets: string;
  reps: string;
  weight: string;
  minutes: string;
}

const num = (s: string): number | undefined => {
  const v = Number(s.replace(',', '.'));
  return s.trim() && Number.isFinite(v) && v > 0 ? v : undefined;
};
const str = (n: number | undefined) => (n === undefined ? '' : String(n));
const toRows = (list: readonly (Exercise | { name: string })[]): Row[] =>
  list.map((e, i) => ({
    key: i,
    name: e.name,
    sets: str('sets' in e ? e.sets : undefined),
    reps: str('reps' in e ? e.reps : undefined),
    weight: str('weightKg' in e ? e.weightKg : undefined),
    minutes: str('durationMin' in e ? e.durationMin : undefined),
  }));

export function SessionEditor({
  target,
  sessions,
  templates,
  onClose,
}: {
  target: SessionTarget;
  /** Own sessions (suggestions and "last time" values). */
  sessions: readonly Session[];
  /** Saved templates, offered as chips on a new session. */
  templates: readonly Stored<Template>[];
  onClose: () => void;
}) {
  return (
    <Dialog
      askAfterTyping
      open={target !== null}
      onClose={onClose}
      title={target && target !== 'new' ? t.fitness.editSession : t.fitness.addSession}
    >
      {target ? (
        <Fields
          key={target === 'new' ? 'new' : target.id}
          target={target}
          sessions={sessions}
          templates={templates}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

function Fields({
  target,
  sessions,
  templates,
  onClose,
}: {
  target: NonNullable<SessionTarget>;
  sessions: readonly Session[];
  templates: readonly Stored<Template>[];
  onClose: () => void;
}) {
  const existing = target === 'new' ? null : target;
  const [opened] = useState(existing);
  const [date, setDate] = useState(existing?.date ?? today());
  const [time, setTime] = useState(existing?.time ?? (existing ? '' : nowTime()));
  const [title, setTitle] = useState(existing?.title ?? '');
  const [duration, setDuration] = useState(str(existing?.durationMin));
  const [note, setNote] = useState(existing?.note ?? '');
  const [planned, setPlanned] = useState(existing?.planned ?? false);
  const [autoPlanned, setAutoPlanned] = useState(false);
  const [rows, setRows] = useState<Row[]>(() =>
    toRows(existing?.exercises.length ? existing.exercises : [{ name: '' }]),
  );
  const [error, setError] = useState('');
  const names = exerciseSuggestions(sessions, builtInExercises());
  const listId = 'fitness-exercise-names';

  const patch = (key: number, p: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  /** A known name with empty numbers takes the values of last time. */
  function prefill(row: Row) {
    if (row.sets || row.reps || row.weight || row.minutes || !row.name.trim()) return;
    const last = lastOf(sessions, row.name);
    if (last)
      patch(row.key, {
        sets: str(last.sets),
        reps: str(last.reps),
        weight: str(last.weightKg),
        minutes: str(last.durationMin),
      });
  }

  /** A template fills title, duration and exercises (the date and the plan stay as they are). */
  function apply(tpl: Template) {
    setTitle(tpl.title);
    setDuration(str(tpl.durationMin));
    setRows(toRows(tpl.exercises.length ? tpl.exercises : [{ name: '' }]));
  }

  /** „Geplant“ on a new session: the clock time of now makes no sense for later, the user sets one. */
  function togglePlanned(on: boolean) {
    setPlanned(on);
    if (on && !existing) setTime('');
  }

  function collect() {
    return {
      date,
      ...(time ? { time } : {}),
      ...(title.trim() ? { title: title.trim() } : {}),
      ...(num(duration) ? { durationMin: Math.round(num(duration)!) } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      exercises: rows
        .filter((r) => r.name.trim())
        .map((r) => ({
          name: r.name.trim(),
          ...(num(r.sets) ? { sets: Math.round(num(r.sets)!) } : {}),
          ...(num(r.reps) ? { reps: Math.round(num(r.reps)!) } : {}),
          ...(num(r.weight) !== undefined
            ? { weightKg: Math.round(num(r.weight)! * 10) / 10 }
            : {}),
          ...(num(r.minutes) ? { durationMin: Math.round(num(r.minutes)!) } : {}),
        })),
      ...(planned ? { planned: true } : {}),
    };
  }

  async function saveTemplate() {
    const tpl = templateSchema.safeParse(toTemplate(collect(), t.fitness.untitled));
    if (!tpl.success || tpl.data.exercises.length === 0)
      return setError(t.fitness.form.emptySession);
    // The same title again replaces that template (a second tap never makes a copy).
    const same = templates.find(
      (x) => x.title.trim().toLocaleLowerCase() === tpl.data.title.toLocaleLowerCase(),
    );
    if (same) await templateRepo.update(same.id, tpl.data);
    else await templateRepo.create(tpl.data);
    useUiStore.getState().toast(t.fitness.templates.saved);
  }

  async function save() {
    const data = collect();
    // A new session needs one exercise or a duration; an existing one (e.g. from the assistant) stays editable.
    // A plan may be just its title („Beine“); the planner gives it a usual length.
    if (!existing && data.exercises.length === 0 && !data.durationMin && !(planned && data.title))
      return setError(t.fitness.form.emptySession);
    const parsed = sessionSchema.safeParse(data);
    if (!parsed.success) return setError(t.fitness.form.invalid);
    if (existing) {
      const full = {
        time: undefined,
        title: undefined,
        durationMin: undefined,
        note: undefined,
        planned: undefined,
        ...parsed.data,
      };
      await sessionRepo.update(existing.id, changedFields(opened ?? existing, full));
    } else await sessionRepo.create(parsed.data);
    onClose();
  }

  return (
    <Form onSubmit={save}>
      {/* Templates only on a fresh form: a tap never overwrites exercises already typed. */}
      {!existing && templates.length > 0 && !rows.some((r) => r.name.trim()) ? (
        <div className={styles.chips} role="group" aria-label={t.fitness.templates.label}>
          {templates.map((tpl) => (
            <span key={tpl.id} className={styles.chip}>
              <Button
                variant="secondary"
                size="sm"
                aria-label={t.fitness.templates.use(tpl.title)}
                onClick={() => apply(tpl)}
              >
                {tpl.title}
              </Button>
              <IconButton
                label={t.fitness.templates.remove(tpl.title)}
                onClick={() =>
                  void deleteWithUndo(
                    () => templateRepo.remove(tpl.id),
                    t.fitness.templates.removed,
                  )
                }
              >
                <Icon name="close" size={16} />
              </IconButton>
            </span>
          ))}
        </div>
      ) : null}
      <div className={styles.split}>
        <TextField
          label={t.fitness.form.date}
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            // A new session on a later day is a plan, unless the user says otherwise.
            if (!existing && e.target.value > today()) {
              togglePlanned(true);
              setAutoPlanned(true);
            } else if (autoPlanned) {
              // Back to today or earlier: the automatic tick goes again (a tick the user set stays).
              setPlanned(false);
              setAutoPlanned(false);
            }
          }}
          required
        />
        <TextField
          label={t.fitness.form.duration}
          type="number"
          inputMode="numeric"
          min={1}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />
      </div>
      <Checkbox
        label={t.fitness.planned.toggle}
        description={t.fitness.planned.toggleHint}
        checked={planned}
        onChange={(e) => {
          togglePlanned(e.target.checked);
          setAutoPlanned(false);
        }}
      />
      {planned ? (
        <TextField
          label={t.fitness.form.time}
          hint={t.fitness.planned.timeHint}
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
      ) : null}
      <p className={styles.groupLabel}>{t.fitness.form.exercises}</p>
      <datalist id={listId}>
        {names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <ul className={styles.exercises}>
        {rows.map((r, i) => (
          <li key={r.key} className={styles.exercise}>
            <TextField
              label={t.fitness.form.exercise}
              list={listId}
              value={r.name}
              onChange={(e) => patch(r.key, { name: e.target.value })}
              onBlur={() => prefill(r)}
              {...(i === 0 ? { 'data-autofocus': true } : {})}
            />
            {rows.length > 1 ? (
              <IconButton
                label={t.fitness.form.removeExercise(r.name || t.fitness.form.exercise)}
                onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
              >
                <Icon name="trash" />
              </IconButton>
            ) : null}
            <div className={styles.numbers}>
              <TextField
                label={t.fitness.form.sets}
                type="number"
                inputMode="numeric"
                min={1}
                value={r.sets}
                onChange={(e) => patch(r.key, { sets: e.target.value })}
              />
              <TextField
                label={t.fitness.form.reps}
                type="number"
                inputMode="numeric"
                min={1}
                value={r.reps}
                onChange={(e) => patch(r.key, { reps: e.target.value })}
              />
              <TextField
                label={t.fitness.form.weight}
                inputMode="decimal"
                value={r.weight}
                onChange={(e) => patch(r.key, { weight: e.target.value })}
              />
              <TextField
                label={t.fitness.form.minutes}
                type="number"
                inputMode="numeric"
                min={1}
                value={r.minutes}
                onChange={(e) => patch(r.key, { minutes: e.target.value })}
              />
            </div>
          </li>
        ))}
      </ul>
      <div className={styles.chips}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            setRows((rs) => [
              ...rs,
              {
                key: Math.max(0, ...rs.map((x) => x.key)) + 1,
                name: '',
                sets: '',
                reps: '',
                weight: '',
                minutes: '',
              },
            ])
          }
        >
          <Icon name="plus" size={16} />
          {t.fitness.form.addExercise}
        </Button>
        {rows.some((r) => r.name.trim()) ? (
          <Button variant="secondary" size="sm" onClick={() => void saveTemplate()}>
            {t.fitness.templates.save}
          </Button>
        ) : null}
      </div>
      <AdvancedFields
        moduleId="fitness"
        hasData={Boolean(existing?.title || existing?.note || existing?.time)}
      >
        <TextField
          label={t.fitness.form.title}
          hint={t.fitness.form.titleHint}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        {planned ? null : (
          <TextField
            label={t.fitness.form.time}
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        )}
        <TextField
          label={t.fitness.form.note}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </AdvancedFields>
      {error ? <p role="alert">{error}</p> : null}
      <FormActions
        start={
          existing ? (
            <Button
              variant="danger"
              onClick={async () => {
                await deleteWithUndo(() => sessionRepo.remove(existing.id));
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
