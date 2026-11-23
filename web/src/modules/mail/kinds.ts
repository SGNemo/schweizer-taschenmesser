/**
 * What kind of mail a row is, from local rules only (no model, nothing leaves the device): the filters
 * „Rechnungen“ and „Newsletter“ beside „Persönlich“, and the waiting queue (`queue.ts`), which leaves invoices and
 * newsletters out. One table of rules, pinned as a table in `__tests__/mail.queue.test.ts`.
 */
import type { MailThreadSummary } from '@/core/mail/types';

export type MailKind = 'invoice' | 'newsletter' | 'other';

/** Bills, reminders and debits, as a shop, an office or a lawyer word them (subject or preview). */
const INVOICE =
  /(rechnung|invoice|receipt|quittung|zahlungserinnerung|mahnung|zahlungsaufforderung|beitragsbescheid|kostennote|honorarnote|\bforderung|abbuchung|lastschrift|kontoauszug|payment due|offener betrag)/i;

/** Gmail's own bulk tabs: promotions, social networks, forums. („Updates“ also holds bills, so it is no hint.) */
const BULK_TABS = ['CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_FORUMS'];

type KindInput = Pick<MailThreadSummary, 'subject' | 'snippet' | 'labelIds' | 'personal'>;

/**
 * The rules, in this order: a bulk tab is a newsletter (marketing says „Rechnung“ too); invoice words make an
 * invoice; a sender that is not a person (`List-Unsubscribe`, `Precedence: bulk`) is a newsletter; the rest is
 * „other“ (people, offices, work).
 */
export function kindOf(th: KindInput): MailKind {
  if (th.labelIds.some((l) => BULK_TABS.includes(l))) return 'newsletter';
  if (INVOICE.test(`${th.subject} ${th.snippet}`)) return 'invoice';
  if (th.personal === false) return 'newsletter';
  return 'other';
}

/** The filters of the list beside „Persönlich“ (`?kind=`); anything else in the address is ignored. */
export const KIND_FILTERS = ['invoice', 'newsletter'] as const;
export type KindFilter = (typeof KIND_FILTERS)[number];

export const kindFilterOf = (value: string | null): KindFilter | undefined =>
  KIND_FILTERS.find((k) => k === value);
