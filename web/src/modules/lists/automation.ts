import type { ModuleAutomation } from '@/core/automation/module';

/** Rules may add items (`create`, to the shopping list by default); nothing is checked off or removed. */
export const automation: ModuleAutomation = {
  watch: { item: { fields: { name: 'text', quantity: 'text', done: 'boolean', listId: 'text' } } },
  actions: ['create'],
};

export default automation;
