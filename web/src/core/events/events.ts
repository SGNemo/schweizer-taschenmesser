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
    amountMinor: number;
    /** 'YYYY-MM-DD' */
    paidAt: string;
    note?: string;
    /** ISO 4217 code; none means euro. */
    currency?: string;
  };
  /** A paid invoice was reopened. Finance removes the expense it booked. */
  'invoice.unpaid': { invoiceId: string };
  /** Something wants to be remembered (a news article, a shared link). The bookmarks module stores it. */
  'bookmark.requested': {
    title: string;
    url: string;
    note?: string;
    /** What it is (the bookmarks module ignores a value it does not know); none means "read later". */
    kind?: 'link' | 'read' | 'watch' | 'book' | 'place' | 'idea' | 'other';
    tags?: string[];
  };
  /** Something is running low (pantry). The shopping list adds the item unless it is already open there. */
  'shopping.requested': { name: string; quantity?: string };
  /** Something becomes a to-do (a checklist item in a note). The todos module adds it to the inbox. */
  'todo.requested': { title: string; note?: string };
  'module.enabled': { moduleId: string };
  'module.disabled': { moduleId: string; policy: DataPolicy };
}
