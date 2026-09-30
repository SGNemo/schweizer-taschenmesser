import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { t } from '@/strings';
import { Button, Dialog, Form, FormActions, SelectField, Split, TextArea, TextField } from '@/ui';
import { contractRepo } from '../repo';
import { contractSchema, KINDS, type Contract, type ContractKind } from '../schema';

export type ContractTarget = Stored<Contract> | { draft: true } | null;

export function ContractEditor({
  target,
  onClose,
}: {
  target: ContractTarget;
  onClose: () => void;
}) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={existing ? t.contracts.edit : t.contracts.add}
    >
      {target ? <Fields key={existing?.id ?? 'new'} existing={existing} onClose={onClose} /> : null}
    </Dialog>
  );
}

function Fields({ existing, onClose }: { existing: Stored<Contract> | null; onClose: () => void }) {
  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<ContractKind>(existing?.kind ?? 'contract');
  const [provider, setProvider] = useState(existing?.provider ?? '');
  const [startDate, setStartDate] = useState(existing?.startDate ?? '');
  const [endDate, setEndDate] = useState(existing?.endDate ?? '');
  const [notice, setNotice] = useState(existing?.noticeDays?.toString() ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState('');

  async function save() {
    const parsed = contractSchema.safeParse({
      name: name.trim(),
      kind,
      provider: provider.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      noticeDays: notice.trim() === '' ? undefined : Number(notice),
      note: note.trim() || undefined,
    });
    if (!parsed.success) return setError(t.contracts.invalid);
    if (existing) await contractRepo.update(existing.id, parsed.data);
    else await contractRepo.create(parsed.data);
    onClose();
  }

  return (
    <Form onSubmit={() => void save()}>
      <TextField
        label={t.contracts.name}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        data-autofocus
      />
      <Split>
        <SelectField
          label={t.contracts.kind}
          value={kind}
          onChange={(e) => setKind(e.target.value as ContractKind)}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {t.contracts.kinds[k]}
            </option>
          ))}
        </SelectField>
        <TextField
          label={t.contracts.provider}
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        />
      </Split>
      <Split>
        <TextField
          label={t.contracts.startDate}
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <TextField
          label={t.contracts.endDate}
          type="date"
          value={endDate}
          onChange={(e) => {
            setEndDate(e.target.value);
            setError('');
          }}
          error={error}
        />
      </Split>
      <TextField
        label={t.contracts.noticeDays}
        hint={t.contracts.noticeHint}
        type="number"
        inputMode="numeric"
        min={0}
        value={notice}
        onChange={(e) => setNotice(e.target.value)}
      />
      <TextArea label={t.form.note} value={note} onChange={(e) => setNote(e.target.value)} />
      <FormActions
        start={
          existing ? (
            <Button
              variant="danger"
              onClick={async () => {
                await contractRepo.remove(existing.id);
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
