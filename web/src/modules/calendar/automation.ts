import type { ModuleAutomation } from '@/core/automation/module';

/** Rules may add events or reminders (`create`); existing ones are never changed. */
export const automation: ModuleAutomation = {
  watch: {
    event: {
      fields: {
        title: 'text',
        kind: 'text',
        startDate: 'date',
        startTime: 'time',
        allDay: 'boolean',
      },
    },
  },
  actions: ['create'],
};

export default automation;
