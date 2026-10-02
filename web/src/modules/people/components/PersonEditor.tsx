import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { pad2, today } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, Checkbox, Dialog, Form, FormActions, TextField } from '@/ui';
import { deletePerson, personRepo } from '../repo';
import { personSchema, type Person } from '../schema';

export type PersonTarget = Stored<Person> | { draft: true } | null;

/** A leap year, so 29 February is a valid value while the year is unknown. */
const PLACEHOLDER_YEAR = 2000;

const parseTags = (text: string): string[] => [
  ...new Set(
    text
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  ),
];

export function PersonEditor({
  target,
  onClose,
  onDeleted,
}: {
  target: PersonTarget;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={existing ? t.people.edit : t.people.add}
    >
      {target ? (
        <Fields
          key={existing?.id ?? 'new'}
          existing={existing}
          onClose={onClose}
          onDeleted={onDeleted}
        />
      ) : null}
    </Dialog>
  );
}

function Fields({
  existing,
  onClose,
  onDeleted,
}: {
  existing: Stored<Person> | null;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const b = existing?.birthday;
  const [name, setName] = useState(existing?.name ?? '');
  const [hasBirthday, setHasBirthday] = useState(existing ? !!b : true);
  const [date, setDate] = useState(
    b ? `${b.year ?? PLACEHOLDER_YEAR}-${pad2(b.month)}-${pad2(b.day)}` : today(),
  );
  const [yearUnknown, setYearUnknown] = useState(b ? b.year === undefined : false);
  const [tags, setTags] = useState(existing?.tags.join(', ') ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState('');

  async function save() {
    const [y, m, d] = date.split('-').map(Number);
    const parsed = personSchema.safeParse({
      name: name.trim(),
      birthday: hasBirthday ? { month: m, day: d, year: yearUnknown ? undefined : y } : undefined,
      tags: parseTags(tags),
      note: note.trim() || undefined,
    });
    if (!parsed.success) return setError(t.people.invalidDate);
    if (existing) await personRepo.update(existing.id, parsed.data);
    else await personRepo.create(parsed.data);
    onClose();
  }

  return (
    <Form onSubmit={() => void save()}>
      <TextField
        label={t.people.name}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        data-autofocus
      />
      <Checkbox
        label={t.people.hasBirthday}
        checked={hasBirthday}
        onChange={(e) => setHasBirthday(e.target.checked)}
      />
      {hasBirthday ? (
        <>
          <TextField
            label={t.people.birthdayDate}
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
            label={t.people.yearUnknown}
            checked={yearUnknown}
            onChange={(e) => setYearUnknown(e.target.checked)}
          />
        </>
      ) : null}
      <TextField label={t.people.tags} value={tags} onChange={(e) => setTags(e.target.value)} />
      <TextField label={t.people.note} value={note} onChange={(e) => setNote(e.target.value)} />
      <FormActions
        start={
          existing ? (
            <Button
              variant="danger"
              onClick={async () => {
                await deletePerson(existing.id);
                onClose();
                onDeleted?.();
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
