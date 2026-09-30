import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { t } from '@/strings';
import { Button, Dialog, Form, FormActions, SelectField, Split, TextArea, TextField } from '@/ui';
import { parseCount } from '../logic';
import { itemRepo } from '../repo';
import { PLACES, type PantryItem, type Place } from '../schema';

export type ItemTarget = Stored<PantryItem> | { draft: true } | null;

export function ItemEditor({ target, onClose }: { target: ItemTarget; onClose: () => void }) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={existing ? t.pantry.edit : t.pantry.add}
    >
      {target ? <Fields key={existing?.id ?? 'new'} existing={existing} onClose={onClose} /> : null}
    </Dialog>
  );
}

function Fields({
  existing,
  onClose,
}: {
  existing: Stored<PantryItem> | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [place, setPlace] = useState<Place>(existing?.place ?? 'pantry');
  const [count, setCount] = useState(String(existing?.count ?? 1));
  const [minCount, setMinCount] = useState(
    existing?.minCount === undefined ? '' : String(existing.minCount),
  );
  const [expires, setExpires] = useState(existing?.expires ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [errors, setErrors] = useState<{ name?: string; count?: string; minCount?: string }>({});

  async function save() {
    const c = parseCount(count);
    const m = minCount.trim() === '' ? null : parseCount(minCount);
    const next = {
      name: name.trim() ? undefined : t.form.required,
      count: c === undefined ? t.pantry.badCount : undefined,
      minCount: m === undefined ? t.pantry.badCount : undefined,
    };
    setErrors(next);
    if (next.name || next.count || next.minCount || c === undefined || m === undefined) return;
    const data = {
      name: name.trim(),
      place,
      count: c,
      minCount: m ?? undefined,
      expires: expires || undefined,
      note: note.trim() || undefined,
    };
    if (existing) await itemRepo.update(existing.id, data);
    else await itemRepo.create(data);
    onClose();
  }

  return (
    <Form onSubmit={() => void save()}>
      <TextField
        label={t.pantry.name}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
        data-autofocus
      />
      <SelectField
        label={t.pantry.place}
        value={place}
        onChange={(e) => setPlace(e.target.value as Place)}
      >
        {PLACES.map((p) => (
          <option key={p} value={p}>
            {t.pantry.places[p]}
          </option>
        ))}
      </SelectField>
      <Split>
        <TextField
          label={t.pantry.count}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          error={errors.count}
          inputMode="numeric"
        />
        <TextField
          label={t.pantry.minCount}
          hint={t.pantry.minCountHint}
          value={minCount}
          onChange={(e) => setMinCount(e.target.value)}
          error={errors.minCount}
          inputMode="numeric"
        />
      </Split>
      <TextField
        label={t.pantry.expires}
        type="date"
        value={expires}
        onChange={(e) => setExpires(e.target.value)}
      />
      <TextArea label={t.form.note} value={note} onChange={(e) => setNote(e.target.value)} />
      <FormActions
        start={
          existing ? (
            <Button
              variant="danger"
              onClick={async () => {
                await itemRepo.remove(existing.id);
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
