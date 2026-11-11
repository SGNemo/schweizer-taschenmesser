import { useNavigate } from 'react-router';
import type { Stored } from '@/core/db/types';
import { formatMoney } from '@/core/money';
import { formatDay, today } from '@/core/time/dates';
import { dueState } from '@/core/time/due';
import { t } from '@/strings';
import { Button, DetailPanel, NoReadAid } from '@/ui';
import { remainingMinor } from '../logic';
import type { Invoice } from '../schema';

/**
 * The invoice picked in the list, in the panel of the wide page (master–detail): payee, what is still open, the
 * date and the payment data. Paying stays the row's own button; changing it is the dialog behind
 * "Bearbeiten"; deleting and copying the payment data stay in the row's menu and in that dialog.
 */
export function InvoiceDetail({
  invoice: i,
  onEdit,
  onClose,
}: {
  invoice: Stored<Invoice>;
  onEdit: () => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const e = t.invoices.ext;
  const open = i.status === 'open';
  const state = dueState(i.dueDate, today(), { done: !open });
  const rest = remainingMinor(i);
  const money = (minor: number) => formatMoney(minor, i.currency);
  const facts = [
    open
      ? {
          label: t.invoices.dueDate,
          // The row carries the coloured badge ("war am … fällig"); here the same fact is plain text, once.
          value:
            state.tone !== 'later'
              ? `${formatDay(i.dueDate, 'EEEE, d. MMMM yyyy')} · ${state.label}`
              : formatDay(i.dueDate, 'EEEE, d. MMMM yyyy'),
        }
      : { label: t.invoices.paidAt, value: formatDay(i.paidAt ?? i.dueDate, 'd. MMMM yyyy') },
    ...(open && rest !== i.amountMinor
      ? [{ label: e.state.partial, value: e.detail.rest(money(rest), money(i.amountMinor)) }]
      : []),
    ...(i.reference ? [{ label: e.pay.reference, value: i.reference }] : []),
    // Account numbers are read digit by digit: no reading aid on them.
    ...(i.iban ? [{ label: e.pay.iban, value: <NoReadAid>{i.iban}</NoReadAid> }] : []),
    ...(i.repeat ? [{ label: t.invoices.repeat, value: t.invoices.repeatOptions[i.repeat] }] : []),
    ...(i.dunningLevel ? [{ label: e.dunning.label, value: e.dunning.level(i.dunningLevel) }] : []),
    ...(i.note ? [{ label: t.form.note, value: i.note }] : []),
  ];
  return (
    <DetailPanel
      testId="invoice-detail"
      eyebrow={e.detail.eyebrow}
      title={i.payee}
      figure={<span data-testid="invoice-detail-amount">{money(open ? rest : i.amountMinor)}</span>}
      facts={facts}
      onClose={onClose}
      actions={
        <>
          {/* Paying and reopening are the row's own button, one click in the list: not repeated here. */}
          <Button onClick={onEdit} data-row-edit>
            {t.actions.edit}
          </Button>
          {!open ? (
            <Button variant="ghost" onClick={() => void navigate(`/finance?open=inv-${i.id}`)}>
              {e.openBooking}
            </Button>
          ) : null}
        </>
      }
    />
  );
}
