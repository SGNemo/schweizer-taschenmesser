import type { ModuleAutomation } from '@/core/automation/module';

/**
 * Mail only reports (`mail.invoiceReceived`, from the notification poll, see `notifyService.ts`).
 * It has no aiSchema, so no rule can write to it, and the event never carries more than sender,
 * subject, amount and due date, which stay on this device.
 */
export const automation: ModuleAutomation = {
  events: {
    'mail.invoiceReceived': {
      fields: { payee: 'text', subject: 'text', amountMinor: 'number', dueDate: 'date' },
    },
  },
};

export default automation;
