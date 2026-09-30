import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { today } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, Checkbox, Dialog, Form, FormActions, TextField } from '@/ui';
import { birthdayRepo } from '../repo';
import { birthdaySchema, type Birthday } from '../schema';

export type BirthdayTarget = Stored<Birthday> | { draft: true } | null;

export function BirthdayEditor({
  target,
  onClose,
}: {
  target: BirthdayTarget;
  onClose: () => void;
}) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={existing ? t.birthdays.edit : t.birthdays.add}
    >
      {target ? <Fields key={existing?.id ?? 'new'} existing={existing} onClose={onClose} /> : null}
    </Dialog>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
/** A leap year, so 29 February is a valid value while the year is unknown. */
const PLACEHOLDER_YEAR = 2000;

function Fields({ existing, onClose }: { existing: Stored<Birthday> | null; onClose: () => void }) {
  const [name, setName] = useState(existing?.name ?? '');
  const [date, setDate] = useState(
    existing
      ? `${existing.year ?? PLACEHOLDER_YEAR}-${pad(existing.month)}-${pad(existing.day)}`
      : today(),
  );
  const [yearUnknown, setYearUnknown] = useState(existing ? existing.year === undefined : false);
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState('');

  async function save() {
    const [y, m, d] = date.split('-').map(Number);
    const parsed = birthdaySchema.safeParse({
      name: name.trim(),
      month: m,
      day: d,
      year: yearUnknown ? undefined : y,
      note: note.trim() || undefined,
    });
    if (!parsed.success) return setError(t.birthdays.invalidDate);
    if (existing) await birthdayRepo.update(existing.id, parsed.data);
    else await birthdayRepo.create(parsed.data);
    onClose();
  }

  return (
    <Form onSubmit={() => void save()}>
      <TextField
        label={t.birthdays.name}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        data-autofocus
      />
      <TextField
        label={t.birthdays.date}
        type="date"
        value={date}
        onChange={(e) => {
          setDate(e.target.value);
          setError('');
        }}
        error={error}
        required
      />
      <Checkbox
        label={t.birthdays.yearUnknown}
        checked={yearUnknown}
        onChange={(e) => setYearUnknown(e.target.checked)}
      />
      <TextField label={t.form.note} value={note} onChange={(e) => setNote(e.target.value)} />
      <FormActions
        start={
          existing ? (
            <Button
              variant="danger"
              onClick={async () => {
                await birthdayRepo.remove(existing.id);
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
