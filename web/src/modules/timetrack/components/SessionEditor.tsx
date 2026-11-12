import { changedFields } from '@/core/db/patch';
import { useState } from 'react';
import type { Stored } from '@/core/db/types';
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
  SelectField,
  TextField,
  TimeField,
} from '@/ui';
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
      askAfterTyping
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
  // The record as the editor opened it: only fields that differ from it are saved (QA X01).
  const [opened] = useState(existing);
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
    if (existing) await sessionRepo.update(existing.id, changedFields(opened ?? existing, data));
    else await sessionRepo.create(data);
    onClose();
  }

  return (
    <Form onSubmit={save}>
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
      <DayField
        label={t.timetrack.form.date}
        value={date}
        onChange={setDate}
        required
        data-autofocus
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <TimeField label={t.timetrack.form.start} value={start} onChange={setStart} required />
        {running ? null : (
          <TimeField label={t.timetrack.form.end} value={end} onChange={setEnd} required />
        )}
      </div>
      <TextField
        label={t.timetrack.form.note}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {/* First what is needed: project, day, from, to, note. A break and an end on another day are rare. */}
      <AdvancedFields
        moduleId="timetrack"
        hasData={(breakMin !== '' && breakMin !== '0') || (!!endDate && endDate !== date)}
      >
        {running ? null : (
          <DayField label={t.timetrack.form.endDate} value={endDate} onChange={setEndDate} />
        )}
        <TextField
          label={t.timetrack.form.breakMin}
          type="number"
          inputMode="numeric"
          min={0}
          value={breakMin}
          onChange={(e) => setBreakMin(e.target.value)}
        />
      </AdvancedFields>
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
