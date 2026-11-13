import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { addDaysStr, formatDay } from '@/core/time/dates';
import { changeWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import { Button, DayField, Dialog, Form, FormActions } from '@/ui';
import { endOf, renewedEnd, renewPatch } from '../logic';
import { documentRepo } from '../repo';
import type { VaultDocument } from '../schema';

/**
 * "Verlängert": the one step after a contract, an insurance or a paper was renewed. The new end is proposed (one
 * more term of the same length) and shown for confirmation; nothing is written before "Verlängerung speichern".
 * Without a start date there is nothing to propose and the field stays empty.
 */
export function RenewDialog({
  doc,
  onClose,
}: {
  doc: Stored<VaultDocument> | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={doc !== null}
      onClose={onClose}
      title={doc ? t.vault.renewAria(doc.title) : t.vault.renewDialog.title}
    >
      {doc ? <Fields key={doc.id} doc={doc} onClose={onClose} /> : null}
    </Dialog>
  );
}

function Fields({ doc, onClose }: { doc: Stored<VaultDocument>; onClose: () => void }) {
  const r = t.vault.renewDialog;
  const end = endOf(doc)!;
  const proposal = renewedEnd(doc);
  const [value, setValue] = useState(proposal ?? '');
  const [error, setError] = useState('');
  const long = (date: string) => formatDay(date, 'd. MMMM yyyy');

  async function save() {
    if (!value || value <= end) return setError(r.notLater);
    await changeWithUndo(
      () => documentRepo.update(doc.id, renewPatch(doc, value)),
      t.vault.renewed(doc.title, formatDay(value, 'd. MMM yyyy')),
    );
    onClose();
  }

  return (
    <Form onSubmit={() => void save()}>
      <p>{r.until(long(end))}</p>
      <DayField
        label={r.newEnd}
        value={value}
        onChange={(next) => {
          setValue(next);
          setError('');
        }}
        hint={proposal ? r.proposed(long(addDaysStr(end, 1))) : r.noStart}
        error={error}
        required
      />
      <FormActions>
        <Button onClick={onClose}>{t.actions.cancel}</Button>
        <Button type="submit" variant="primary">
          {r.save}
        </Button>
      </FormActions>
    </Form>
  );
}
