import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { today } from '@/core/time/dates';
import { deleteWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import { Button, Dialog, Form, FormActions, SelectField, TextField } from '@/ui';
import { sessionRepo } from '../repo';
import { sessionSchema, type Job, type Session } from '../schema';

export type SessionTarget = Stored<Session> | 'new' | null;

/** Manual entry and edit: project, day, start, end (and end day), break, note. */
export function SessionEditor({
  target,
  jobs,
  onClose,
}: {
  target: SessionTarget;
  jobs: readonly Stored<Job>[];
  onClose: () => void;
}) {
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={target === 'new' || target === null ? t.timetrack.add : t.timetrack.edit}
    >
      {target ? (
        <Fields
          key={target === 'new' ? 'new' : target.id}
          target={target}
          jobs={jobs}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

function Fields({
  target,
  jobs,
  onClose,
}: {
  target: NonNullable<SessionTarget>;
  jobs: readonly Stored<Job>[];
  onClose: () => void;
}) {
  const existing = target === 'new' ? null : target;
  // A running session (no end yet) stays running when it is edited: no end, its pause is kept.
  const running = Boolean(existing && !existing.endTime);
  const [jobId, setJobId] = useState(existing?.jobId ?? jobs[0]?.id ?? '');
  const [date, setDate] = useState(existing?.date ?? today());
  const [start, setStart] = useState(existing?.startTime ?? '09:00');
  const [end, setEnd] = useState(existing?.endTime ?? '10:00');
  const [endDate, setEndDate] = useState(existing?.endDate ?? '');
  const [breakMin, setBreakMin] = useState(String(existing?.breakMin ?? 0));
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState('');

  async function save() {
    const data = {
      jobId: jobId || undefined,
      date,
      startTime: start,
      endTime: running ? undefined : end,
      endDate: !running && endDate && endDate !== date ? endDate : undefined,
      breakMin: Math.max(0, Math.round(Number(breakMin) || 0)),
      note: note.trim() || undefined,
      pausedAt: running ? existing?.pausedAt : undefined,
      pausedDate: running ? existing?.pausedDate : undefined,
    };
    const sameDayBackwards = !running && (data.endDate ?? date) === date && end <= start;
    if (!sessionSchema.safeParse(data).success || sameDayBackwards || (data.endDate ?? date) < date)
      return setError(t.errors.generic);
    if (existing) await sessionRepo.update(existing.id, data);
    else await sessionRepo.create(data);
    onClose();
  }

  return (
    <Form onSubmit={() => void save()}>
      <SelectField
        label={t.timetrack.form.job}
        value={jobId}
        onChange={(e) => setJobId(e.target.value)}
      >
        <option value="">{t.timetrack.noJob}</option>
        {jobs.map((j) => (
          <option key={j.id} value={j.id}>
            {j.name}
          </option>
        ))}
      </SelectField>
      <TextField
        label={t.timetrack.form.date}
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
        data-autofocus
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <TextField
          label={t.timetrack.form.start}
          type="time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          required
        />
        {running ? null : (
          <TextField
            label={t.timetrack.form.end}
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            required
          />
        )}
      </div>
      {running ? null : (
        <TextField
          label={t.timetrack.form.endDate}
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      )}
      <TextField
        label={t.timetrack.form.breakMin}
        type="number"
        inputMode="numeric"
        min={0}
        value={breakMin}
        onChange={(e) => setBreakMin(e.target.value)}
      />
      <TextField
        label={t.timetrack.form.note}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {error ? <p role="alert">{error}</p> : null}
      <FormActions
        start={
          existing ? (
            <Button
              variant="danger"
              onClick={() => {
                void deleteWithUndo(() => sessionRepo.remove(existing.id));
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
