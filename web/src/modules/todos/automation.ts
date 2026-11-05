import type { AutomationEventDef, ModuleAutomation } from '@/core/automation/module';

const TASK: AutomationEventDef = {
  fields: { title: 'text', done: 'boolean', dueDate: 'date', priority: 'number', listId: 'text' },
};

/**
 * Rules may add tasks (`create`); they never change or delete existing ones. A write that touches only
 * `plannedFor`/`planMark` (the planner's write-back, but also a user's „Später“ tap) reports no
 * `updated` event; `todos.task.completed` is unaffected.
 */
export const automation: ModuleAutomation = {
  watch: { task: { ...TASK, ignoreFields: ['plannedFor', 'planMark'] } },
  events: { 'todos.task.completed': TASK },
  derive: (signal, base) =>
    signal.table === 'todos_task' &&
    signal.kind === 'updated' &&
    signal.before?.done === false &&
    signal.data?.done === true
      ? [{ ...base, type: 'todos.task.completed', key: `completed:${signal.id}:${base.at}` }]
      : [],
  actions: ['create'],
};

export default automation;
