import { dateTimeFormat } from '@/core/i18n/format';
import type { MailAddress } from '@/core/mail/types';
import { toDateString, today } from '@/core/time/dates';
import { t } from '@/strings';

export type DayGroup = 'today' | 'yesterday' | 'week' | 'older';

const DAY = 86_400_000;

/** Which list group a mail of `ms` belongs to (local calendar days, relative to `today()`). */
export function dayGroup(ms: number): DayGroup {
  const day = toDateString(new Date(ms));
  const now = new Date(today() + 'T12:00:00').getTime();
  const diff = Math.round((now - new Date(day + 'T12:00:00').getTime()) / DAY);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'yesterday';
  return diff < 7 ? 'week' : 'older';
}

/** "14:05" for today's mail, "3. Okt." for older ones, with the year when it is not this year. */
export function shortWhen(ms: number): string {
  const d = new Date(ms);
  if (toDateString(d) === today())
    return dateTimeFormat({ hour: '2-digit', minute: '2-digit' }).format(d);
  const sameYear = d.getFullYear() === new Date(today() + 'T12:00:00').getFullYear();
  return dateTimeFormat(
    sameYear
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' },
  ).format(d);
}

export const fullWhen = (ms: number): string =>
  dateTimeFormat({ dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms));

export const personName = (a: MailAddress): string => a.name?.trim() || a.email;

export const subjectOf = (s: string): string => s.trim() || t.mail.page.noSubject;

/** Subject or sender looks like an invoice (local keyword check; nothing leaves the device). */
export function looksLikeInvoice(subject: string, from: MailAddress): boolean {
  return /rechnung|invoice|faktura|factura|facture|fatura|zahlungserinnerung|mahnung|payment due|beleg/i.test(
    `${subject} ${from.name ?? ''}`,
  );
}
