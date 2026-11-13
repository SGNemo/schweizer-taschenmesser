import { useEffect, useRef, useState } from 'react';
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
  onSaved,
}: {
  doc: Stored<VaultDocument> | null;
  onClose: () => void;
  /** Called after the renewal was written, before the dialog closes. */
  onSaved?: () => void;
}) {
  // One write per dialog. The lock lives here, not in the form: the write changes the term, the form below starts
  // afresh for it, and a second Enter in that moment must not renew the next term on top.
  const writing = useRef(false);
  const lock = () => {
    if (writing.current) return false;
    writing.current = true;
    return true;
  };
  const unlock = () => {
    writing.current = false;
  };
  // The lock comes back only once the dialog is closed for good (not while it is closing: the form below may
  // already show the next term).
  const open = doc !== null;
  useEffect(() => {
    if (!open) writing.current = false;
  }, [open]);
  return (
    <Dialog
      open={doc !== null}
      onClose={onClose}
      title={doc ? t.vault.renewAria(doc.title) : t.vault.renewDialog.title}
    >
      {/* A new term from elsewhere (start or end) starts the dialog afresh: field and hint never describe two different terms. */}
      {doc ? (
        <Fields
          key={`${doc.id}:${doc.startDate}:${endOf(doc)}`}
          doc={doc}
          onClose={onClose}
          onSaved={onSaved}
          lock={lock}
          unlock={unlock}
        />
      ) : null}
    </Dialog>
  );
}

function Fields({
  doc,
  onClose,
  onSaved,
  lock,
  unlock,
}: {
  doc: Stored<VaultDocument>;
  onClose: () => void;
  onSaved?: () => void;
  /** Takes the dialog's one write; false while another one runs. */
  lock: () => boolean;
  unlock: () => void;
}) {
  const r = t.vault.renewDialog;
  const end = endOf(doc)!;
  const proposal = renewedEnd(doc);
  const [value, setValue] = useState(proposal ?? '');
  const [error, setError] = useState('');
  const long = (date: string) => formatDay(date, 'd. MMMM yyyy');

  async function save() {
    if (!value || value <= end) return setError(r.notLater);
    if (!lock()) return;
    try {
      await changeWithUndo(
        () => documentRepo.update(doc.id, renewPatch(doc, value)),
        t.vault.renewed(doc.title, formatDay(value, 'd. MMM yyyy')),
      );
      onSaved?.();
      onClose();
    } catch {
      // Deleted meanwhile (another device): nothing to renew.
      unlock();
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
    <Form onSubmit={save}>
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
        // Nothing proposed: the date is what is missing. A proposal only waits for its confirmation below.
        data-autofocus={proposal ? undefined : true}
      />
      <FormActions>
        <Button onClick={onClose}>{t.actions.cancel}</Button>
        <Button type="submit" variant="primary" data-autofocus={proposal ? true : undefined}>
          {r.save}
        </Button>
      </FormActions>
    </Form>
  );
}
