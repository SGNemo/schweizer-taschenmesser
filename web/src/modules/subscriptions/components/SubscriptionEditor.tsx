import { changedFields } from '@/core/db/patch';
import { useState, type FormEvent } from 'react';
import type { Stored } from '@/core/db/types';
import {
  currencyOf,
  formatMoney,
  formatMoneyInput,
  isCurrencyCode,
  parseMoney,
} from '@/core/money';
import { formatDay } from '@/core/time/dates';
import { NoticeField } from '@/core/deadline/NoticeField';
import { tDeadline } from '@/strings.deadline';
import { tDraft } from '@/strings.draft';
import { RecurrenceEditor } from '@/core/recurrence/RecurrenceEditor';
import type { Recurrence } from '@/core/recurrence/types';
import { today } from '@/core/time/dates';
import { t } from '@/strings';
import { changePercent, nextCancelDeadline, recordPriceChange, trialDaysLeft } from '../logic';
import {
  AdvancedFields,
  Button,
  CurrencyField,
  Dialog,
  patternStyles,
  SelectField,
  Switch,
  TextArea,
  TextField,
  useFormDraft,
} from '@/ui';
import { annualCost } from '../logic';
import { subscriptionRepo } from '../repo';
import { SUBSCRIPTION_CATEGORIES, type Subscription, type SubscriptionCategory } from '../schema';
import styles from '../routes/subscriptions.module.css';
import { deleteWithUndo } from '@/core/undo/withToast';

export type SubscriptionTarget = Stored<Subscription> | { draft: true } | null;

export function SubscriptionEditor({
  target,
  onClose,
  suggestedAmountMinor,
}: {
  target: SubscriptionTarget;
  onClose: () => void;
  /** A price seen in the bookings (finance's hint opens the editor with it): offered, never applied by itself. */
  suggestedAmountMinor?: number;
}) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={existing ? t.subscriptions.edit : t.subscriptions.add}
    >
      {target ? (
        <Form
          key={existing?.id ?? 'new'}
          existing={existing}
          onClose={onClose}
          suggestedAmountMinor={existing ? suggestedAmountMinor : undefined}
        />
      ) : null}
    </Dialog>
  );
}

function Form({
  existing,
  onClose,
  suggestedAmountMinor,
}: {
  existing: Stored<Subscription> | null;
  onClose: () => void;
  suggestedAmountMinor?: number;
}) {
  const dl = tDeadline.use();
  // Typed text survives Esc or a tap beside the dialog (memory only, 30 minutes); saving and
  // "Abbrechen" drop it.
  const dr = tDraft.use();
  const draft = useFormDraft(`subscriptions:subscription:${existing?.id ?? 'new'}`, {
    name: existing?.name ?? '',
    amount: existing ? formatMoneyInput(existing.amountMinor) : '',
    currency: currencyOf(existing),
    startDate: existing?.startDate ?? today(),
    recurrence: (existing?.recurrence ?? { freq: 'monthly', interval: 1 }) as Recurrence,
    notice: existing?.cancelNoticeDays as number | undefined,
    noticeMonths: existing?.cancelNoticeMonths as number | undefined,
    active: existing?.active ?? true,
    note: existing?.note ?? '',
    trialEndsOn: existing?.trialEndsOn ?? '',
    category: (existing?.category ?? '') as SubscriptionCategory | '',
    paymentMethod: existing?.paymentMethod ?? '',
  });
  const {
    name,
    amount,
    currency,
    startDate,
    recurrence,
    notice,
    noticeMonths,
    active,
    note,
    trialEndsOn,
    category,
    paymentMethod,
  } = draft.values;
  const setName = (v: string) => draft.set('name', v);
  const setAmount = (v: string) => draft.set('amount', v);
  const setCurrency = (v: string) => draft.set('currency', v);
  const setStartDate = (v: string) => draft.set('startDate', v);
  const setRecurrence = (v: Recurrence) => draft.set('recurrence', v);
  const setNotice = (v: number | undefined, months?: number) => {
    draft.set('notice', v);
    draft.set('noticeMonths', months);
  };
  const setActive = (v: boolean) => draft.set('active', v);
  const setNote = (v: string) => draft.set('note', v);
  const setTrialEndsOn = (v: string) => draft.set('trialEndsOn', v);
  const setCategory = (v: SubscriptionCategory | '') => draft.set('category', v);
  const setPaymentMethod = (v: string) => draft.set('paymentMethod', v);
  // The record as the editor opened it: only fields that differ from it are saved (QA X01).
  const [opened] = useState(existing);
  const [error, setError] = useState('');

  const amountMinor = parseMoney(amount);
  const monthly = amountMinor
    ? Math.round(annualCost({ amountMinor, recurrence }) / 12)
    : undefined;

  const cancelBy =
    notice !== undefined && !recurrence.until
      ? nextCancelDeadline(
          { recurrence, startDate, cancelNoticeDays: notice, cancelNoticeMonths: noticeMonths },
          today(),
        )?.deadline
      : undefined;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!amountMinor || amountMinor < 1) {
      setError(t.money.invalidAmount(formatMoneyInput(1250)));
      return;
    }
    if (!isCurrencyCode(currency)) {
      setError(t.money.currencyInvalid);
      return;
    }
    const data = {
      name: name.trim(),
      amountMinor,
      currency: currency === 'EUR' ? undefined : currency,
      recurrence,
      startDate,
      cancelNoticeDays: notice,
      cancelNoticeMonths: notice === undefined ? undefined : noticeMonths,
      active,
      note: note.trim() || undefined,
      trialEndsOn: trialEndsOn || undefined,
      category: category || undefined,
      paymentMethod: paymentMethod.trim() || undefined,
      priceHistory: existing
        ? recordPriceChange(existing.priceHistory ?? [], today(), existing.amountMinor, amountMinor)
        : [],
    };
    if (existing)
      await subscriptionRepo.update(existing.id, changedFields(opened ?? existing, data));
    else await subscriptionRepo.create(data);
    draft.clear();
    onClose();
  }
  const cancel = () => {
    draft.clear();
    onClose();
  };

  return (
    <form onSubmit={save} className={styles.form}>
      {draft.restored ? (
        <p role="status" data-testid="draft-restored">
          {dr.restored}{' '}
          <Button variant="ghost" onClick={draft.discard}>
            {dr.discard}
          </Button>
        </p>
      ) : null}
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
          hint={monthly ? t.subscriptions.monthlyCost(formatMoney(monthly, currency)) : undefined}
          required
        />
        <TextField
          label={t.subscriptions.firstCharge}
          type="date"
          value={startDate}
          onChange={(e) => {
            // A monthly rule that followed the old day keeps following the first-charge date.
            const oldDay = Number(startDate.slice(8, 10));
            if (recurrence.freq === 'monthly' && recurrence.byMonthDay === oldDay)
              setRecurrence({ ...recurrence, byMonthDay: undefined });
            setStartDate(e.target.value);
          }}
          required
        />
      </div>
      {suggestedAmountMinor && suggestedAmountMinor !== amountMinor ? (
        <p role="status" className={styles.suggest} data-testid="price-suggestion">
          <span>
            {t.subscriptions.ext.suggest.seen(formatMoney(suggestedAmountMinor, currency))}
          </span>
          <Button variant="ghost" onClick={() => setAmount(formatMoneyInput(suggestedAmountMinor))}>
            {t.subscriptions.ext.suggest.apply(formatMoney(suggestedAmountMinor, currency))}
          </Button>
        </p>
      ) : null}
      <RecurrenceEditor
        value={recurrence}
        onChange={(r) => r && setRecurrence(r)}
        startDate={startDate}
        required
        followStartDay
      />
      {existing ? (
        <TextField
          label={t.subscriptions.cancelledTo}
          type="date"
          value={recurrence.until ?? ''}
          onChange={(e) => {
            setRecurrence({ ...recurrence, until: e.target.value || undefined, count: undefined });
          }}
          hint={t.subscriptions.cancelledToHint}
          min={startDate}
        />
      ) : null}
      {existing && existing.priceHistory?.length ? (
        <div data-testid="price-history">
          <h3>{t.subscriptions.priceHistory}</h3>
          <ul>
            {[...existing.priceHistory].reverse().map((c) => (
              <li key={`${c.date}-${c.toMinor}`}>
                {t.subscriptions.priceChange(
                  formatDay(c.date, 'd. MMM yyyy'),
                  formatMoney(c.fromMinor, currencyOf(existing)),
                  formatMoney(c.toMinor, currencyOf(existing)),
                  changePercent(c),
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {cancelBy ? (
        <p className={styles.cancelBig} data-testid="cancel-by">
          <span>{dl.cancelBy}</span>
          <strong>{formatDay(cancelBy, 'd. MMM yyyy')}</strong>
        </p>
      ) : null}
      <AdvancedFields
        moduleId="subscriptions"
        hasData={
          notice !== undefined ||
          !!note ||
          currencyOf(existing) !== 'EUR' ||
          !!trialEndsOn ||
          !!category ||
          !!paymentMethod
        }
      >
        <CurrencyField label={t.money.currency} value={currency} onChange={setCurrency} />
        <NoticeField days={notice} months={noticeMonths} onChange={setNotice} max={365} />
        <TextField
          label={t.subscriptions.ext.trial.label}
          type="date"
          value={trialEndsOn}
          onChange={(e) => setTrialEndsOn(e.target.value)}
          hint={
            trialEndsOn && trialDaysLeft({ trialEndsOn }, today()) !== undefined
              ? t.subscriptions.ext.trial.daysLeft(trialDaysLeft({ trialEndsOn }, today())!)
              : t.subscriptions.ext.trial.hint
          }
        />
        <SelectField
          label={t.subscriptions.ext.category.label}
          value={category}
          onChange={(e) => setCategory(e.target.value as SubscriptionCategory | '')}
        >
          <option value="">–</option>
          {SUBSCRIPTION_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t.subscriptions.ext.category[c]}
            </option>
          ))}
        </SelectField>
        <TextField
          label={t.subscriptions.ext.payment.label}
          value={paymentMethod}
          placeholder={t.subscriptions.ext.payment.placeholder}
          onChange={(e) => setPaymentMethod(e.target.value)}
          maxLength={40}
        />
        <TextArea label={t.form.note} value={note} onChange={(e) => setNote(e.target.value)} />
      </AdvancedFields>
      {existing ? (
        <Switch label={t.subscriptions.active} checked={active} onChange={setActive} />
      ) : null}
      <div className={styles.actions}>
        {existing ? (
          <Button
            variant="danger"
            onClick={async () => {
              await deleteWithUndo(() => subscriptionRepo.remove(existing.id));
              draft.clear();
              onClose();
            }}
          >
            {t.actions.delete}
          </Button>
        ) : (
          <span />
        )}
        <span className={patternStyles.hstack}>
          <Button onClick={cancel}>{t.actions.cancel}</Button>
          <Button type="submit" variant="primary">
            {t.actions.save}
          </Button>
        </span>
      </div>
    </form>
  );
}
