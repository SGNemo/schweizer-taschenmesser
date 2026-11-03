/**
 * Central catalogue of cross-module events. Adding an event here is the
 * "defined interface" through which modules communicate.
 */
export type DataPolicy = 'keep' | 'delete';

export interface EventMap {
  /** An invoice was marked as paid (or a paid invoice was edited). Finance books an expense. */
  'invoice.paid': {
    invoiceId: string;
    payee: string;
    /** What was still open when the invoice was paid (the whole amount without part payments; 0 when part payments covered it). */
    amountMinor: number;
    /** 'YYYY-MM-DD' */
    paidAt: string;
    note?: string;
    /** ISO 4217 code; none means euro. */
    currency?: string;
  };
  /** A paid invoice was reopened. Finance removes the expense it booked. */
  'invoice.unpaid': { invoiceId: string };
  /** A part of an invoice was paid. Finance books an expense `inv-<invoiceId>-<paymentId>`; `invoice.paid` then carries only the rest. */
  'invoice.payment': {
    invoiceId: string;
    paymentId: string;
    payee: string;
    amountMinor: number;
    /** 'YYYY-MM-DD' */
    date: string;
    note?: string;
    /** ISO 4217 code; none means euro. */
    currency?: string;
  };
  /** A part payment was removed again. Finance removes the expense it booked for it. */
  'invoice.paymentRemoved': { invoiceId: string; paymentId: string };
  /** Something wants to be remembered (a news article, a shared link). The bookmarks module stores it. */
  'bookmark.requested': { title: string; url: string; note?: string };
  /** Something is running low (pantry). The shopping list adds the item unless it is already open there. */
  'shopping.requested': { name: string; quantity?: string };
  /** Something was bought (shopping list). The pantry adds the amount to the item of that name or creates it. */
  'pantry.restock': { name: string; quantity?: string };
  /** A saved link could be a gift idea (bookmarks). The people module keeps it until the reader picks a person. */
  'gift.requested': { title: string; url?: string; priceCents?: number };
  /** Something becomes a to-do (a checklist item in a note). The todos module adds it to the inbox. */
  'todo.requested': {
    title: string;
    note?: string;
    dueDate?: string;
    /** Where the to-do came from (a note, a mail, an invoice, an event): only the id and the title. */
    link?: { kind: 'note' | 'mail' | 'invoice' | 'event'; id: string; label: string };
  };
  /** Something starts the clock (a calendar event: "Zeit erfassen"). Time tracking starts a session without a project, titled as a note. */
  'timetrack.start.requested': { title: string; sourceRef?: string };
  'module.enabled': { moduleId: string };
  'module.disabled': { moduleId: string; policy: DataPolicy };
}
