import { formatMoney } from '@/core/money';
import { getPlatform } from '@/core/platform';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { formatIban } from './iban';
import { paymentBlock, remainingMinor } from './logic';
import type { Invoice } from './schema';

/** Copies payee, IBAN, reference and the amount still to pay as one block for the banking app. */
export async function copyPaymentData(
  i: Pick<
    Invoice,
    'payee' | 'iban' | 'bic' | 'reference' | 'amountMinor' | 'payments' | 'currency'
  >,
): Promise<void> {
  const l = t.invoices.ext.pay;
  const text = paymentBlock(i, formatMoney(remainingMinor(i), i.currency), {
    recipient: l.recipient,
    iban: l.iban,
    bic: l.bic,
    reference: l.reference,
    amount: l.amount,
  });
  await getPlatform().clipboard.writeText(text);
  useUiStore.getState().toast(l.copied);
}

export async function copyIban(iban: string): Promise<void> {
  await getPlatform().clipboard.writeText(formatIban(iban));
  useUiStore.getState().toast(t.invoices.ext.pay.ibanCopied);
}

/** Largest file kept with an invoice (the store is on this device only). */
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
export const attachmentKey = (invoiceId: string): string => `invoices:${invoiceId}`;
export const ATTACHMENT_ACCEPT = 'application/pdf,image/*';
export const isAttachable = (mime: string): boolean =>
  mime === 'application/pdf' || mime.startsWith('image/');
