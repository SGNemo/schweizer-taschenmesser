import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { addDaysStr, formatDay, today } from '@/core/time/dates';
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
 *
 * `doc` is the row as the list holds it right now, not a copy from the moment of the click: a change that arrives
 * while the dialog is open (sync, another window) is what the renewal builds on.
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
      {/* A new end from elsewhere starts the dialog afresh: field and hint never describe two different terms. */}
      {doc ? <Fields key={`${doc.id}:${endOf(doc)}`} doc={doc} onClose={onClose} /> : null}
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
    try {
      await changeWithUndo(
        () => documentRepo.update(doc.id, renewPatch(doc, value)),
        t.vault.renewed(doc.title, formatDay(value, 'd. MMM yyyy')),
      );
      onClose();
    } catch {
      // Deleted meanwhile (another device): nothing to renew.
      setError(r.gone);
    }
  }

  // What the field holds decides the hint: a date still behind us says so, the untouched proposal says what it is.
  const hint = !proposal
    ? r.noStart
    : value && value < today()
      ? r.stillPast
      : value === proposal
        ? r.proposed
        : undefined;

  return (
    <Form onSubmit={() => void save()}>
      <p>
        {r.until(long(end))}
        {/* Said before it happens: the start is the new term's first day afterwards. */}
        {doc.startDate ? ` ${r.startMoves(long(addDaysStr(end, 1)))}` : null}
      </p>
      <DayField
        label={r.newEnd}
        value={value}
        onChange={(next) => {
          setValue(next);
          setError('');
        }}
        hint={hint}
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
