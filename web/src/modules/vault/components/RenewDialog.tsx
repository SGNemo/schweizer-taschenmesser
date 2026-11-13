import { useId, useState } from 'react';
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
      {/* A new term from elsewhere (start or end) starts the dialog afresh: field and hint never describe two different terms. */}
      {doc ? (
        <Fields key={`${doc.id}:${doc.startDate}:${endOf(doc)}`} doc={doc} onClose={onClose} />
      ) : null}
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
  const ids = useId();
  // A proposal that can be confirmed as it stands: it exists and does not lie behind us.
  const ready = proposal !== undefined && proposal >= today();

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

  // What the field holds decides the hint: a date behind us says so, the untouched proposal says what it is.
  const hint =
    value && value < today()
      ? r.stillPast
      : !proposal
        ? r.noStart
        : value === proposal
          ? r.proposed
          : undefined;

  return (
    <Form onSubmit={() => void save()}>
      <p id={`${ids}-was`}>
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
        // Nothing proposed, or a proposal that still lies in the past: the date is what needs a look first.
        data-autofocus={ready ? undefined : true}
      />
      <p id={`${ids}-new`} className="sr-only">
        {value ? `${r.newEnd}: ${long(value)}` : ''}
      </p>
      <FormActions>
        <Button onClick={onClose}>{t.actions.cancel}</Button>
        <Button
          type="submit"
          variant="primary"
          // A proposal that holds only waits for its confirmation. What is confirmed is read with the button: the
          // old end, the move of the start and the proposed date.
          data-autofocus={ready ? true : undefined}
          aria-describedby={`${ids}-was ${ids}-new`}
        >
          {r.save}
        </Button>
      </FormActions>
    </Form>
  );
}
