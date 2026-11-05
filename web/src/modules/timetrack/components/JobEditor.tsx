import { changedFields } from '@/core/db/patch';
import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { formatMoneyInput, parseMoney } from '@/core/money';
import { deleteWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import { Button, Dialog, Form, FormActions, SelectField, TextField, categoryColor } from '@/ui';
import { clientRepo, jobRepo } from '../repo';
import { jobSchema, type Client, type Job } from '../schema';
import styles from '../timetrack.module.css';

export type JobTarget = Stored<Job> | 'new' | null;

/** A project: name, client (existing or new), colour, hourly rate, billable. */
export function JobEditor({
  target,
  clients,
  nextOrder,
  onClose,
}: {
  target: JobTarget;
  clients: readonly Stored<Client>[];
  nextOrder: number;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={target === 'new' || target === null ? t.timetrack.job.add : t.timetrack.job.edit}
    >
      {target ? (
        <Fields
          key={target === 'new' ? 'new' : target.id}
          target={target}
          clients={clients}
          nextOrder={nextOrder}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

function Fields({
  target,
  clients,
  nextOrder,
  onClose,
}: {
  target: NonNullable<JobTarget>;
  clients: readonly Stored<Client>[];
  nextOrder: number;
  onClose: () => void;
}) {
  const existing = target === 'new' ? null : target;
  // The record as the editor opened it: only fields that differ from it are saved (QA X01).
  const [opened] = useState(existing);
  const [name, setName] = useState(existing?.name ?? '');
  const [clientId, setClientId] = useState(existing?.clientId ?? '');
  const [newClient, setNewClient] = useState('');
  const [tone, setTone] = useState(existing?.tone ?? nextOrder % 6);
  const [rate, setRate] = useState(existing?.rateCents ? formatMoneyInput(existing.rateCents) : '');
  const [billable, setBillable] = useState(existing?.billable ?? true);
  const [error, setError] = useState('');

  async function save() {
    const rateCents = rate.trim() ? parseMoney(rate) : undefined;
    if (rate.trim() && rateCents === undefined) return setError(t.errors.generic);
    let cid = clientId || undefined;
    const fresh = newClient.trim();
    const data = {
      name: name.trim(),
      clientId: cid,
      tone,
      rateCents,
      billable,
      order: existing?.order ?? nextOrder,
      archived: existing?.archived,
    };
    if (!jobSchema.safeParse(data).success) return setError(t.errors.generic);
    if (fresh) {
      cid = (await clientRepo.create({ name: fresh, order: clients.length })).id;
      data.clientId = cid;
    }
    if (existing) await jobRepo.update(existing.id, changedFields(opened ?? existing, data));
    else await jobRepo.create(data);
    onClose();
  }

  return (
    <Form onSubmit={() => void save()}>
      <TextField
        label={t.timetrack.job.name}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        data-autofocus
      />
      <SelectField
        label={t.timetrack.job.client}
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
      >
        <option value="">{t.timetrack.noClient}</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      <TextField
        label={t.timetrack.job.newClient}
        value={newClient}
        onChange={(e) => setNewClient(e.target.value)}
      />
      <TextField
        label={t.timetrack.job.rate}
        inputMode="decimal"
        value={rate}
        onChange={(e) => setRate(e.target.value)}
      />
      <label>
        <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} />{' '}
        {t.timetrack.job.billable}
      </label>
      <div role="group" aria-label={t.timetrack.job.colour}>
        <p className={styles.meta}>{t.timetrack.job.colour}</p>
        <div className={styles.swatches}>
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={styles.chip}
              aria-pressed={tone === n}
              aria-label={t.timetrack.job.colourN(n + 1)}
              onClick={() => setTone(n)}
            >
              <span
                className={styles.dot}
                style={{ background: categoryColor(n) }}
                aria-hidden="true"
              />
              {n + 1}
            </button>
          ))}
        </div>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <FormActions
        start={
          existing ? (
            <Button
              variant="danger"
              onClick={async () => {
                // The recorded time stays: sessions of a deleted project fall back to "Ohne Projekt".
                await deleteWithUndo(() => jobRepo.remove(existing.id));
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
