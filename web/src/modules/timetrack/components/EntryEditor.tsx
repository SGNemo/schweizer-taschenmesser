import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { today } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, Dialog, Form, FormActions, SelectField, Split, TextArea, TextField } from '@/ui';
import { formatMinutes, parseDuration } from '../logic';
import { entryRepo } from '../repo';
import type { Entry, Project } from '../schema';

export type EntryTarget = Stored<Entry> | { draft: true } | null;

interface Props {
  target: EntryTarget;
  projects: readonly Stored<Project>[];
  onClose: () => void;
}

export function EntryEditor({ target, projects, onClose }: Props) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={existing ? t.timetrack.editEntry : t.timetrack.addEntry}
    >
      {target ? (
        <Fields
          key={existing?.id ?? 'new'}
          existing={existing}
          projects={projects}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

function Fields({
  existing,
  projects,
  onClose,
}: {
  existing: Stored<Entry> | null;
  projects: readonly Stored<Project>[];
  onClose: () => void;
}) {
  const [projectId, setProjectId] = useState(existing?.projectId ?? projects[0]?.id ?? '');
  const [date, setDate] = useState(existing?.date ?? today());
  const [duration, setDuration] = useState(existing ? formatMinutes(existing.minutes) : '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | undefined>();

  async function save() {
    const minutes = parseDuration(duration);
    if (minutes === undefined) return setError(t.timetrack.badDuration);
    if (!projectId || !date) return;
    const data = { projectId, date, minutes, note: note.trim() || undefined };
    if (existing) await entryRepo.update(existing.id, data);
    else await entryRepo.create(data);
    onClose();
  }

  return (
    <Form onSubmit={() => void save()}>
      <SelectField
        label={t.timetrack.project}
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </SelectField>
      <Split>
        <TextField
          label={t.timetrack.date}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <TextField
          label={t.timetrack.duration}
          hint={t.timetrack.durationHint}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          error={error}
          autoComplete="off"
          data-autofocus
        />
      </Split>
      <TextArea label={t.timetrack.note} value={note} onChange={(e) => setNote(e.target.value)} />
      <FormActions
        start={
          existing ? (
            <Button
              variant="danger"
              onClick={async () => {
                await entryRepo.remove(existing.id);
                onClose();
              }}
            >
              {t.timetrack.deleteEntry}
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
