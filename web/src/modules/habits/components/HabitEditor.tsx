import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { t } from '@/strings';
import { Button, Chip, Chips, Dialog, Form, FormActions, Switch, TextField } from '@/ui';
import { deleteHabit, habitRepo } from '../repo';
import { ALL_DAYS, type Habit } from '../schema';

export type HabitTarget = Stored<Habit> | { draft: true } | null;

export function HabitEditor({ target, onClose }: { target: HabitTarget; onClose: () => void }) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={existing ? t.habits.edit : t.habits.add}
    >
      {target ? <Fields key={existing?.id ?? 'new'} existing={existing} onClose={onClose} /> : null}
    </Dialog>
  );
}

function Fields({ existing, onClose }: { existing: Stored<Habit> | null; onClose: () => void }) {
  const [name, setName] = useState(existing?.name ?? '');
  const [days, setDays] = useState<number[]>(existing?.weekdays ?? ALL_DAYS);
  const [archived, setArchived] = useState(existing?.archived ?? false);

  const toggle = (d: number) =>
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()));

  async function save() {
    const data = { name: name.trim(), weekdays: days, archived };
    if (existing) await habitRepo.update(existing.id, data);
    else await habitRepo.create(data);
    onClose();
  }

  return (
    <Form onSubmit={() => void save()}>
      <TextField
        label={t.habits.name}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        data-autofocus
      />
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend
          style={{ fontSize: 'var(--text-sm)', fontWeight: 550, marginBottom: 'var(--space-2)' }}
        >
          {t.habits.weekdays}
        </legend>
        <Chips>
          {t.habits.dayNames.map((label, i) => (
            <Chip
              key={label}
              label={label}
              selected={days.includes(i + 1)}
              onClick={() => toggle(i + 1)}
            />
          ))}
        </Chips>
        {days.length === 0 ? <p role="alert">{t.habits.needDay}</p> : null}
      </fieldset>
      {existing ? (
        <Switch label={t.habits.archive} checked={archived} onChange={setArchived} />
      ) : null}
      <FormActions
        start={
          existing ? (
            <Button
              variant="danger"
              onClick={async () => {
                await deleteHabit(existing.id);
                onClose();
              }}
            >
              {t.actions.delete}
            </Button>
          ) : undefined
        }
      >
        <Button onClick={onClose}>{t.actions.cancel}</Button>
        <Button type="submit" variant="primary" disabled={days.length === 0}>
          {t.actions.save}
        </Button>
      </FormActions>
    </Form>
  );
}
