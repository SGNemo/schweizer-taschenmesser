/**
 * Invoices as link targets (`contributions.linkTarget`, docs/design/planner-hub/CONCEPT-LINKS.md §1.4): reads only this
 * module's own data, never the network. The id is untrusted: anything that is no live invoice here – a foreign or
 * malformed id, a soft-deleted one – is `gone`.
 */
import type { LinkTarget } from '@/core/modules/types';
import { invoiceRepo } from './repo';

const target: LinkTarget = {
  async resolve(id) {
    const invoice = await invoiceRepo.get(id);
    if (!invoice) return { state: 'gone' };
    return {
      state: 'alive',
      title: invoice.payee,
      to: `/invoices?open=${encodeURIComponent(id)}`,
      // „done“ is the invoice's own state: a link only reads it.
      done: invoice.status === 'paid',
    };
  },
};

export default target;
