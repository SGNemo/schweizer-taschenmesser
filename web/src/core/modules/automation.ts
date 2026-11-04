import type { ModuleAutomation } from '@/core/automation/module';
import type { ModuleAiSchema } from './types';

const EVENT_TYPE = /^[a-z][a-z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*){1,3}$/;
const FIELD = /^[a-zA-Z][a-zA-Z0-9]*$/;

/**
 * Checks a module's `automation.ts` against its manifest: the writes it watches are collections,
 * the events it names are well formed and start with the module id or a short domain word, and the
 * actions rules may call exist in `aiSchema.actions` and never delete. Pure (types only), so
 * `npm run check:modules` and the tests share it.
 */
export function validateAutomation(
  moduleId: string,
  automation: ModuleAutomation,
  collections: readonly string[],
  aiSchema: ModuleAiSchema | undefined,
): string[] {
  const errors: string[] = [];
  const fieldsOf = (where: string, fields: Record<string, string>) => {
    for (const f of Object.keys(fields)) {
      if (!FIELD.test(f)) errors.push(`${where}: field "${f}" is not a plain name`);
    }
  };
  for (const [collection, def] of Object.entries(automation.watch ?? {})) {
    if (!collections.includes(collection))
      errors.push(`automation.watch.${collection}: not a collection of ${moduleId}`);
    fieldsOf(`automation.watch.${collection}`, def.fields);
  }
  for (const [type, def] of Object.entries(automation.events ?? {})) {
    if (!EVENT_TYPE.test(type)) errors.push(`automation.events.${type}: not a valid event type`);
    fieldsOf(`automation.events.${type}`, def.fields);
  }
  const actions = automation.actions ?? [];
  if (actions.length > 0 && !aiSchema)
    errors.push('automation.actions needs an aiSchema (rules write through its actions)');
  const defs = aiSchema?.actions;
  for (const id of aiSchema ? actions : []) {
    const def = defs?.[id];
    if (!def) errors.push(`automation.actions: "${id}" is not in aiSchema.actions`);
    else if (def.kind === 'delete')
      errors.push(`automation.actions: "${id}" deletes, which rules never do`);
  }
  if (automation.detectors && !automation.events)
    errors.push('automation.detectors need their events declared in automation.events');
  return errors;
}
