import type { Stored } from '@/core/db/types';
import { formatMoney } from '@/core/money';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, DetailPanel } from '@/ui';
import { useCurrency } from '../currency';
import { signed } from '../logic';
import type { Transaction } from '../schema';
import type { FinanceData } from '../types';

/**
 * The booking picked in the list, in the panel of the wide page (master–detail): what it is, its amount and the
 * few facts that tell it apart. Changing it is the dialog behind "Bearbeiten" (deleting too, or the row's menu); every number here is the
 * booking's own.
 */
export function TransactionDetail({
  tx,
  data,
  onEdit,
  onClose,
}: {
  tx: Stored<Transaction>;
  data: FinanceData;
  onEdit: () => void;
  onClose: () => void;
}) {
  const currency = useCurrency();
  const e = t.finance.ext.detail;
  const category = data.categories.find((c) => c.id === tx.categoryId);
  const account = data.accounts.find((a) => a.id === tx.accountId);
  const title = tx.payee || tx.note || category?.name || '–';
  const facts = [
    { label: t.finance.account, value: account?.name ?? '–' },
    {
      label: t.finance.category,
      value: tx.splits?.length
        ? t.finance.ext.split.parts(tx.splits.length)
        : (category?.name ?? t.finance.noCategory),
    },
    ...(tx.note && tx.note !== title ? [{ label: t.form.note, value: tx.note }] : []),
    ...(tx.repeat ? [{ label: t.finance.repeat, value: t.finance.repeatOptions[tx.repeat] }] : []),
  ];
  return (
    <DetailPanel
      testId="booking-detail"
      eyebrow={e.eyebrow(formatDay(tx.date, 'EEEE, d. MMMM yyyy'))}
      title={title}
      figure={
        <span data-testid="booking-detail-amount">
          {tx.kind === 'income' ? '+' : '−'}
          {formatMoney(Math.abs(signed(tx)), currency)}
        </span>
      }
      facts={facts}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onEdit} data-row-edit>
            {t.actions.edit}
          </Button>
        </>
      }
    >
      {tx.sourceRef ? (
        <p data-source-note="">
          {tx.sourceRef.startsWith('subscription:')
            ? t.finance.fromSubscription
            : t.finance.fromInvoice}
        </p>
      ) : null}
    </DetailPanel>
  );
}
