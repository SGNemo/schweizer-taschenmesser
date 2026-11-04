/**
 * New mail that looks like an invoice becomes the automation event `mail.invoiceReceived` (only when
 * a rule is switched on does anything happen). Local detection (`core/mail/heuristics`), nothing is
 * sent anywhere; the event carries sender, subject, amount and due date and no mail id, text or link.
 */
import { bus } from '@/core/events';
import { analyzeMessage } from '@/core/mail/heuristics';
import type { MailThreadSummary } from '@/core/mail/types';

export function reportInvoices(threads: readonly MailThreadSummary[]): void {
  for (const t of threads) {
    try {
      const finding = analyzeMessage({
        id: t.id,
        from: t.from.name ? `${t.from.name} <${t.from.email}>` : t.from.email,
        subject: t.subject,
        snippet: t.snippet,
        dateMs: t.date,
        bulk: t.labelIds.includes('CATEGORY_PROMOTIONS'),
      });
      if (finding?.kind !== 'invoice') continue;
      void bus.emit('automation.event', {
        type: 'mail.invoiceReceived',
        moduleId: 'mail',
        key: `mail.invoiceReceived:${t.id}`,
        data: {
          payee: finding.title,
          subject: t.subject,
          ...(finding.amountMinor !== undefined ? { amountMinor: finding.amountMinor } : {}),
          ...(finding.date ? { dueDate: finding.date } : {}),
        },
        // no title: the rule log must not keep anything from a mail
      });
    } catch {
      // a detection problem must never disturb the poll
    }
  }
}
