/**
 * Creating entries from natural language. The model only proposes field values; they are checked
 * against the aiSchema and the collection's real Zod schema, shown to the user, and written
 * through the module's repo only after an explicit confirmation.
 */
import type { z } from 'zod';
import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { recurrenceSchema } from '@/core/recurrence/types';
import { formatFieldValue, fieldLabel } from './format';
import { AiQueryError, type ExecContext, type PreparedCreate } from './types';
import { coerceValue, findField, resolveCollection } from './validate';

/** Validates a `create` intent and returns what would be written. Nothing is stored yet. */
export async function prepareCreate(
  intent: { module: string; collection: string; data: Record<string, unknown> },
  ctx: ExecContext,
): Promise<PreparedCreate> {
  const { manifest, collection, schema } = resolveCollection(intent.module, intent.collection, ctx);
  const def = manifest.dataSchema.collections[collection]!;

  const data: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(intent.data)) {
    if (raw === undefined || raw === null || raw === '') continue;
    const { field, type } = findField(schema, key);
    if (type === 'recurrence') {
      const rule = recurrenceSchema.safeParse(raw);
      if (!rule.success) throw new AiQueryError('bad-value', `${field}=${JSON.stringify(raw)}`);
      data[field] = rule.data;
    } else {
      data[field] = coerceValue(type, raw, field);
    }
  }

  const loadDefaults = manifest.contributions?.aiCreateDefaults;
  if (loadDefaults) {
    const defaults = await (await loadDefaults()).default(collection);
    for (const [k, v] of Object.entries(defaults)) if (!(k in data)) data[k] = v;
  }

  const parsed = def.schema.safeParse(data);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? '')))];
    throw new AiQueryError('invalid-entry', fields.join(', '));
  }
  const clean = Object.fromEntries(
    Object.entries(parsed.data as Record<string, unknown>).filter(([, v]) => v !== undefined),
  );

  const preview = Object.entries(schema.fields).flatMap(([name, type]) => {
    const value = formatFieldValue(type, clean[name]);
    return value === undefined ? [] : [{ label: fieldLabel(name), value }];
  });
  return {
    module: manifest.id,
    moduleName: manifest.name,
    collection,
    label: schema.label,
    data: clean,
    preview,
  };
}

/** Writes a confirmed entry through the module's repo (validates again, stamps, queues sync). */
export async function commitCreate(
  prepared: PreparedCreate,
  ctx: Pick<ExecContext, 'known' | 'database'>,
): Promise<string> {
  const manifest = ctx.known.find((m) => m.id === prepared.module);
  const def = manifest?.dataSchema.collections[prepared.collection];
  if (!manifest || !def) throw new AiQueryError('unknown-collection', prepared.collection);
  const repo = createRepo(
    tableName(manifest.id, prepared.collection),
    def.schema as z.ZodType<Record<string, unknown>>,
    ctx.database,
  );
  return (await repo.create(prepared.data)).id;
}
