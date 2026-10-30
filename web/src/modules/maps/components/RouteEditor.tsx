import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { requireNotice } from '@/core/legal/notices';
import { deleteWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import {
  Button,
  Dialog,
  Form,
  FormActions,
  Icon,
  SelectField,
  Switch,
  TextArea,
  TextField,
} from '@/ui';
import { routeRepo } from '../repo';
import { ROUTE_MODES, type Endpoint, type Place, type Route, type RouteMode } from '../schema';
import { EndpointPicker } from './EndpointPicker';

export type RouteTarget =
  Stored<Route> | { draft: true; from?: Endpoint; to?: Endpoint; name?: string } | null;

export function RouteEditor({
  target,
  places,
  searchUrl,
  onClose,
}: {
  target: RouteTarget;
  places: readonly Stored<Place>[];
  searchUrl: string;
  onClose: () => void;
}) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={existing ? t.maps.route.titleEdit : t.maps.route.titleAdd}
      size="roomy"
    >
      {target ? (
        <Fields
          key={existing?.id ?? 'new'}
          target={target}
          places={places}
          searchUrl={searchUrl}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

function Fields({
  target,
  places,
  searchUrl,
  onClose,
}: {
  target: NonNullable<RouteTarget>;
  places: readonly Stored<Place>[];
  searchUrl: string;
  onClose: () => void;
}) {
  const existing = 'id' in target ? target : null;
  const draft = existing
    ? undefined
    : (target as { from?: Endpoint; to?: Endpoint; name?: string });
  const [name, setName] = useState(existing?.name ?? draft?.name ?? '');
  const [mode, setMode] = useState<RouteMode>(existing?.mode ?? 'walk');
  const [from, setFrom] = useState<Endpoint | undefined>(existing?.from ?? draft?.from);
  const [to, setTo] = useState<Endpoint | undefined>(existing?.to ?? draft?.to);
  const [via, setVia] = useState<(Endpoint | undefined)[]>(existing?.via ?? []);
  const [note, setNote] = useState(existing?.note ?? '');
  const [pinned, setPinned] = useState(existing?.pinned ?? false);
  const [error, setError] = useState('');
  const notice = () => requireNotice('maps');

  async function save() {
    if (!from || !to) return setError(t.maps.route.needEnds);
    const data = {
      name: name.trim() || `${from.label} → ${to.label}`,
      mode,
      from,
      to,
      via: via.filter((v): v is Endpoint => !!v),
      note: note.trim() || undefined,
      pinned,
    };
    if (existing) await routeRepo.update(existing.id, data);
    else await routeRepo.create(data);
    onClose();
  }

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  return (
    <Form onSubmit={() => void save()}>
      <TextField
        label={t.maps.route.name}
        value={name}
        onChange={(e) => setName(e.target.value)}
        data-autofocus
      />
      <SelectField
        label={t.maps.route.mode}
        value={mode}
        onChange={(e) => setMode(e.target.value as RouteMode)}
      >
        {ROUTE_MODES.map((m) => (
          <option key={m} value={m}>
            {t.maps.modes[m]}
          </option>
        ))}
      </SelectField>
      <EndpointPicker
        label={t.maps.route.from}
        value={from}
        places={places}
        onChange={setFrom}
        searchUrl={searchUrl}
        onSearch={notice}
      />
      <div>
        <Button variant="ghost" onClick={swap} aria-label={t.maps.route.swap}>
          <Icon name="swap" size={18} />
          {t.maps.route.swap}
        </Button>
      </div>
      {via.map((v, i) => (
        <div key={i} style={{ display: 'grid', gap: 'var(--space-2)' }}>
          <EndpointPicker
            label={`${t.maps.route.via} ${i + 1}`}
            value={v}
            places={places}
            onChange={(e) => setVia(via.map((x, j) => (j === i ? e : x)))}
            searchUrl={searchUrl}
            onSearch={notice}
          />
          <div>
            <Button variant="ghost" onClick={() => setVia(via.filter((_, j) => j !== i))}>
              {t.maps.route.removeVia}
            </Button>
          </div>
        </div>
      ))}
      <EndpointPicker
        label={t.maps.route.to}
        value={to}
        places={places}
        onChange={setTo}
        searchUrl={searchUrl}
        onSearch={notice}
      />
      {via.length < 3 ? (
        <div>
          <Button variant="ghost" onClick={() => setVia([...via, undefined])}>
            <Icon name="plus" size={18} />
            {t.maps.route.addVia}
          </Button>
        </div>
      ) : null}
      <TextArea label={t.maps.route.note} value={note} onChange={(e) => setNote(e.target.value)} />
      <Switch label={t.maps.route.pinned} checked={pinned} onChange={() => setPinned(!pinned)} />
      {error ? (
        <p role="alert" style={{ margin: 0, color: 'var(--danger-ink)' }}>
          {error}
        </p>
      ) : null}
      <FormActions
        start={
          existing ? (
            <Button
              variant="danger"
              onClick={async () => {
                await deleteWithUndo(() => routeRepo.remove(existing.id));
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
