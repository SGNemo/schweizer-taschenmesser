import { useState, type FormEvent } from 'react';
import type { Stored } from '@/core/db/types';
import { formatMoney, formatMoneyInput, parseMoney } from '@/core/money';
import { RecurrenceEditor } from '@/core/recurrence/RecurrenceEditor';
import type { Recurrence } from '@/core/recurrence/types';
import { today } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, Dialog, patternStyles, Switch, TextArea, TextField } from '@/ui';
import { annualCost } from '../logic';
import { subscriptionRepo } from '../repo';
import type { Subscription } from '../schema';
import styles from '../routes/subscriptions.module.css';

export type SubscriptionTarget = Stored<Subscription> | { draft: true } | null;

export function SubscriptionEditor({
  target,
  onClose,
}: {
  target: SubscriptionTarget;
  onClose: () => void;
}) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={existing ? t.subscriptions.edit : t.subscriptions.add}
    >
      {target ? <Form key={existing?.id ?? 'new'} existing={existing} onClose={onClose} /> : null}
    </Dialog>
  );
}

function Form({
  existing,
  onClose,
}: {
  existing: Stored<Subscription> | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [amount, setAmount] = useState(existing ? formatMoneyInput(existing.amountMinor) : '');
  const [startDate, setStartDate] = useState(existing?.startDate ?? today());
  const [recurrence, setRecurrence] = useState<Recurrence>(
    existing?.recurrence ?? { freq: 'monthly', interval: 1 },
  );
  const [notice, setNotice] = useState(
    existing?.cancelNoticeDays !== undefined ? String(existing.cancelNoticeDays) : '',
  );
  const [active, setActive] = useState(existing?.active ?? true);
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState('');

  const amountMinor = parseMoney(amount);
  const monthly = amountMinor
    ? Math.round(annualCost({ amountMinor, recurrence }) / 12)
    : undefined;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!amountMinor || amountMinor < 1) {
      setError(t.money.invalidAmount(formatMoneyInput(1250)));
      return;
    }
    const days =
      notice.trim() === '' ? undefined : Math.max(0, Math.min(365, Math.round(Number(notice))));
    const data = {
      name: name.trim(),
      amountMinor,
      recurrence,
      startDate,
      cancelNoticeDays: Number.isFinite(days) ? days : undefined,
      active,
      note: note.trim() || undefined,
    };
    if (existing) await subscriptionRepo.update(existing.id, data);
    else await subscriptionRepo.create(data);
    onClose();
  }

  return (
    <form onSubmit={save} className={styles.form}>
      <TextField
        label={t.subscriptions.name}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        data-autofocus
      />
      <div className={styles.split}>
        <TextField
          label={t.money.amount}
          inputMode="decimal"
          placeholder="0,00"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setError('');
          }}
          error={error}
          hint={monthly ? t.subscriptions.monthlyCost(formatMoney(monthly)) : undefined}
          required
        />
        <TextField
          label={t.subscriptions.firstCharge}
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
        />
      </div>
      <RecurrenceEditor
        value={recurrence}
        onChange={(r) => r && setRecurrence(r)}
        startDate={startDate}
        required
      />
      <TextField
        label={t.subscriptions.noticeDays}
        type="number"
        min={0}
        max={365}
        value={notice}
        onChange={(e) => setNotice(e.target.value)}
        hint={t.subscriptions.noticeHint}
      />
      <TextArea label={t.form.note} value={note} onChange={(e) => setNote(e.target.value)} />
      {existing ? (
        <Switch label={t.subscriptions.active} checked={active} onChange={setActive} />
      ) : null}
      <div className={styles.actions}>
        {existing ? (
          <Button
            variant="danger"
            onClick={async () => {
              await subscriptionRepo.remove(existing.id);
              onClose();
            }}
          >
            {t.actions.delete}
          </Button>
        ) : (
          <span />
        )}
        <span className={patternStyles.hstack}>
          <Button onClick={onClose}>{t.actions.cancel}</Button>
          <Button type="submit" variant="primary">
            {t.actions.save}
          </Button>
        </span>
      </div>
    </form>
  );
}
