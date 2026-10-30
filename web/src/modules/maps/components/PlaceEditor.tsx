import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { deleteWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import { Button, Dialog, Form, FormActions, SelectField, Switch, TextArea, TextField } from '@/ui';
import { parseCoordinates, roundCoord } from '../logic';
import { placeRepo } from '../repo';
import { PLACE_CATEGORIES, type Place, type PlaceCategory } from '../schema';

export type PlaceTarget =
  Stored<Place> | { draft: true; name?: string; lat: number; lon: number; address?: string } | null;

export function PlaceEditor({ target, onClose }: { target: PlaceTarget; onClose: () => void }) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={existing ? t.maps.place.titleEdit : t.maps.place.titleAdd}
    >
      {target ? <Fields key={existing?.id ?? 'new'} target={target} onClose={onClose} /> : null}
    </Dialog>
  );
}

const show = (lat: number, lon: number): string => `${roundCoord(lat)}, ${roundCoord(lon)}`;

function Fields({ target, onClose }: { target: NonNullable<PlaceTarget>; onClose: () => void }) {
  const existing = 'id' in target ? target : null;
  const draft = existing
    ? undefined
    : (target as { name?: string; lat: number; lon: number; address?: string });
  const start = existing ?? draft!;
  const [name, setName] = useState(existing?.name ?? draft?.name ?? '');
  const [address, setAddress] = useState(existing?.address ?? draft?.address ?? '');
  const [coords, setCoords] = useState(show(start.lat, start.lon));
  const [category, setCategory] = useState<PlaceCategory>(existing?.category ?? 'other');
  const [note, setNote] = useState(existing?.note ?? '');
  const [pinned, setPinned] = useState(existing?.pinned ?? false);
  const [error, setError] = useState('');

  async function save() {
    const point = parseCoordinates(coords);
    if (!point) return setError(t.maps.place.coordsInvalid);
    const data = {
      name: name.trim(),
      lat: roundCoord(point.lat),
      lon: roundCoord(point.lon),
      address: address.trim() || undefined,
      note: note.trim() || undefined,
      category,
      pinned,
    };
    if (existing) await placeRepo.update(existing.id, data);
    else await placeRepo.create(data);
    onClose();
  }

  return (
    <Form onSubmit={() => void save()}>
      <TextField
        label={t.maps.place.name}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        data-autofocus
      />
      <TextField
        label={t.maps.place.address}
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        autoComplete="off"
      />
      <SelectField
        label={t.maps.place.category}
        value={category}
        onChange={(e) => setCategory(e.target.value as PlaceCategory)}
      >
        {PLACE_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {t.maps.categories[c]}
          </option>
        ))}
      </SelectField>
      <TextField
        label={t.maps.place.coords}
        hint={t.maps.place.coordsHint}
        value={coords}
        onChange={(e) => {
          setCoords(e.target.value);
          setError('');
        }}
        error={error}
        inputMode="decimal"
        autoComplete="off"
      />
      <TextArea label={t.maps.place.note} value={note} onChange={(e) => setNote(e.target.value)} />
      <Switch label={t.maps.place.pinned} checked={pinned} onChange={() => setPinned(!pinned)} />
      <FormActions
        start={
          existing ? (
            <Button
              variant="danger"
              onClick={async () => {
                await deleteWithUndo(() => placeRepo.remove(existing.id));
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
