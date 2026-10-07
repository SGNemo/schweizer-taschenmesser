import type { AiActionHandler } from '@/core/modules/types';
import { markOpen, markPaid } from './actions';

/**
 * "Rechnung bezahlt" through the assistant goes through the module's own logic, so finance books
 * the expense (`invoice.paid`) and an undo reopens the invoice (`invoice.unpaid`).
 */
const handlers: Record<string, AiActionHandler> = {
  markPaid: {
    apply: (id) => markPaid(id),
    revert: (id) => markOpen(id),
  },
};

export default handlers;
