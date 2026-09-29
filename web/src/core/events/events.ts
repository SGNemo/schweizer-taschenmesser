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
  };
  /** A paid invoice was reopened. Finance removes the expense it booked. */
  'invoice.unpaid': { invoiceId: string };
  'module.enabled': { moduleId: string };
  'module.disabled': { moduleId: string; policy: DataPolicy };
}
