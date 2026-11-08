import { useState } from 'react';
import { changedFields } from '@/core/db/patch';
import type { Stored } from '@/core/db/types';
import { nowTime, today } from '@/core/time/dates';
import { deleteWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import {
  AdvancedFields,
  Button,
  Dialog,
  Form,
  FormActions,
  Icon,
  IconButton,
  TextField,
} from '@/ui';
import { builtInExercises } from '../data';
import { exerciseSuggestions, lastOf } from '../logic';
import { sessionRepo } from '../repo';
import { sessionSchema, type Session } from '../schema';
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

export function SessionEditor({
  target,
  sessions,
  onClose,
}: {
  target: SessionTarget;
  /** Own sessions (suggestions and "last time" values). */
  sessions: readonly Session[];
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
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

function Fields({
  target,
  sessions,
  onClose,
}: {
  target: NonNullable<SessionTarget>;
  sessions: readonly Session[];
  onClose: () => void;
}) {
  const existing = target === 'new' ? null : target;
  const [opened] = useState(existing);
  const [date, setDate] = useState(existing?.date ?? today());
  const [time, setTime] = useState(existing?.time ?? (existing ? '' : nowTime()));
  const [title, setTitle] = useState(existing?.title ?? '');
  const [duration, setDuration] = useState(str(existing?.durationMin));
  const [note, setNote] = useState(existing?.note ?? '');
  const [rows, setRows] = useState<Row[]>(() =>
    (existing?.exercises.length ? existing.exercises : [{ name: '' }]).map((e, i) => ({
      key: i,
      name: e.name,
      sets: str('sets' in e ? e.sets : undefined),
      reps: str('reps' in e ? e.reps : undefined),
      weight: str('weightKg' in e ? e.weightKg : undefined),
      minutes: str('durationMin' in e ? e.durationMin : undefined),
    })),
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

  async function save() {
    const data = {
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
    };
    if (data.exercises.length === 0 && !data.durationMin)
      return setError(t.fitness.form.emptySession);
    const parsed = sessionSchema.safeParse(data);
    if (!parsed.success) return setError(t.fitness.form.invalid);
    if (existing) {
      const full = {
        time: undefined,
        title: undefined,
        durationMin: undefined,
        note: undefined,
        ...parsed.data,
      };
      await sessionRepo.update(existing.id, changedFields(opened ?? existing, full));
    } else await sessionRepo.create(parsed.data);
    onClose();
  }

  return (
    <Form onSubmit={save}>
      <div className={styles.split}>
        <TextField
          label={t.fitness.form.date}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
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
      <div>
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
        <TextField
          label={t.fitness.form.time}
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
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
