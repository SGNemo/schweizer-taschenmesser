import type { ModuleManifest } from '@/core/modules/types';
import { t } from '@/strings';
import { fieldLabel, formatFieldValue } from './format';
import type { ResultRow } from './types';

/** Fields shown per result row besides the title. */
const ROW_FIELDS = 4;

export function toResultRow(
  manifest: ModuleManifest,
  collection: string,
  row: Record<string, unknown> & { id: string },
  opts: { withSubtitle?: boolean } = {},
): ResultRow {
  const schema = manifest.aiSchema.collections[collection]!;
  const fields: ResultRow['fields'] = [];
  const ordered = Object.entries(schema.fields).sort(([a], [b]) =>
    a === schema.dateField ? -1 : b === schema.dateField ? 1 : 0,
  );
  for (const [name, type] of ordered) {
    if (name === schema.titleField || fields.length >= ROW_FIELDS) continue;
    const text = formatFieldValue(type, row[name]);
    if (text !== undefined) fields.push({ label: fieldLabel(name), value: text });
  }
  return {
    id: row.id,
    title: String(row[schema.titleField] ?? '') || t.ai.untitled,
    subtitle: opts.withSubtitle ? `${manifest.name} · ${schema.label}` : undefined,
    fields,
    to: manifest.routes[0]?.path,
  };
}
