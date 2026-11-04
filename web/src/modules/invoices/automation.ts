import type { ModuleAutomation } from '@/core/automation/module';
import { now } from '@/core/time/now';
import { daysBetween } from '@/core/time/dates';
import { remainingMinor } from './logic';
import { invoiceRepo } from './repo';

/** Within this many days an open invoice is reported as "due soon" (rules narrow it with `daysLeft`). */
const LOOK_AHEAD_DAYS = 30;

export const automation: ModuleAutomation = {
  watch: {
    invoice: {
      fields: { payee: 'text', amountMinor: 'number', dueDate: 'date', status: 'text' },
    },
  },
  events: {
    'invoice.dueSoon': {
      fields: { payee: 'text', amountMinor: 'number', dueDate: 'date', daysLeft: 'number' },
    },
  },
  detectors: [
    async ({ today }) => {
      const out = [];
      for (const i of await invoiceRepo.active().toArray()) {
        if (i.status !== 'open' || remainingMinor(i) <= 0) continue;
        const daysLeft = daysBetween(today, i.dueDate);
        if (daysLeft < 0 || daysLeft > LOOK_AHEAD_DAYS) continue;
        out.push({
          type: 'invoice.dueSoon',
          moduleId: 'invoices',
          // one occurrence per invoice and due date: the rule fires when its condition first holds
          key: `invoice.dueSoon:${i.id}:${i.dueDate}`,
          at: now(),
          data: {
            id: i.id,
            payee: i.payee,
            amountMinor: remainingMinor(i),
            dueDate: i.dueDate,
            daysLeft,
          },
          title: i.payee,
        });
      }
      return out;
    },
  ],
  // `create`: the mail rule leaves an invoice suggestion; nothing is marked paid.
  actions: ['create'],
};

export default automation;
