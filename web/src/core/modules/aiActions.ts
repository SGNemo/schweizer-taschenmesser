import type { ModuleAiSchema } from './types';

/**
 * Checks `aiSchema.actions`: optional, but when present every action must be complete. Pure (types
 * only), so `validateManifest` and `npm run check:modules` share it.
 */
export function validateAiActions(aiSchema: ModuleAiSchema | undefined): string[] {
  const errors: string[] = [];
  const actions = aiSchema?.actions;
  if (!aiSchema || !actions) return errors;
  for (const [id, a] of Object.entries(actions)) {
    const where = `aiSchema.actions.${id}`;
    const collection = aiSchema.collections[a.collection];
    if (!collection) {
      errors.push(`${where}: collection "${a.collection}" is not in aiSchema.collections`);
      continue;
    }
    if (!a.label.trim() || !a.description.trim()) errors.push(`${where}: label and description`);
    const fields = a.fields ?? [];
    for (const f of [...fields, ...(a.required ?? []), ...Object.keys(a.set ?? {})]) {
      if (!(f in collection.fields)) errors.push(`${where}: "${f}" is not an aiSchema field`);
    }
    for (const f of a.required ?? []) {
      if (!fields.includes(f)) errors.push(`${where}: required "${f}" is not in fields`);
    }
    if ((a.kind === 'create' || a.kind === 'update') && fields.length === 0)
      errors.push(`${where}: ${a.kind} needs fields`);
    if (a.kind === 'transition' && Object.keys(a.set ?? {}).length === 0)
      errors.push(`${where}: transition needs set`);
    if (a.kind === 'delete' && (fields.length > 0 || a.set))
      errors.push(`${where}: delete takes no fields`);
    if (a.examples.length === 0) errors.push(`${where}: at least one example`);
    if (a.kind !== 'create') {
      const hasCreate = Object.values(actions).some(
        (c) => c.kind === 'create' && c.collection === a.collection,
      );
      if (!hasCreate)
        errors.push(`${where}: needs a create action on "${a.collection}" for its examples`);
      if (a.examples.some((e) => !e.target)) errors.push(`${where}: every example needs a target`);
    }
    for (const role of Object.values(a.parse?.roles ?? {})) {
      if (role && !fields.includes(role)) errors.push(`${where}: parse role field "${role}"`);
    }
    if (a.parse && a.parse.keywords.length === 0) errors.push(`${where}: parse.keywords is empty`);
  }
  return errors;
}
