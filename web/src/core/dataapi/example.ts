/** Made-up example items for a module, in the import format (hand-written or generated from the schema). */
import type { ModuleManifest } from '@/core/modules/types';
import { describeCollection, type FieldFormat } from './format';
import { apiCollections } from './scope';

type Json = Record<string, unknown>;

function sampleOf(schema: Json, label: string): unknown {
  if (Array.isArray(schema.enum)) return schema.enum[0];
  if (schema.const !== undefined) return schema.const;
  if (typeof schema.default !== 'undefined') return schema.default;
  const pattern = typeof schema.pattern === 'string' ? schema.pattern : '';
  if (pattern.includes('\\d{4}-\\d{2}-\\d{2}')) return '2026-03-14';
  if (pattern.includes('2[0-3]')) return '09:00';
  switch (schema.type) {
    case 'string':
      return `Beispiel ${label}`;
    case 'integer':
    case 'number': {
      const min = typeof schema.minimum === 'number' ? schema.minimum : 1;
      const max = typeof schema.maximum === 'number' ? schema.maximum : min;
      return Math.min(Math.max(min, 1), max);
    }
    case 'boolean':
      return false;
    case 'array': {
      const min = typeof schema.minItems === 'number' ? schema.minItems : 0;
      return min > 0 ? [sampleOf((schema.items ?? {}) as Json, label)] : [];
    }
    case 'object': {
      const props = (schema.properties ?? {}) as Record<string, Json>;
      const required = (schema.required ?? []) as string[];
      return Object.fromEntries(required.map((k) => [k, sampleOf(props[k] ?? {}, k)]));
    }
    default:
      return undefined;
  }
}

function valueFor(field: FieldFormat, label: string, keyOf: (collection: string) => string) {
  if (field.kind === 'ref') return `@${keyOf(field.refCollection!)}`;
  if (field.kind === 'money') return 12.5;
  return sampleOf(field.schema, label);
}

/** One item per API collection of the module, referenced collections first. */
export function buildExample(manifest: ModuleManifest): Json[] {
  const items: Json[] = [];
  const done = new Set<string>();
  const keyOf = (collection: string) => `${collection}1`;

  const emit = (collection: string, stack: string[]) => {
    if (done.has(collection) || stack.includes(collection)) return;
    const format = describeCollection(manifest, collection);
    for (const f of format.fields) {
      if (f.kind === 'ref' && f.required && f.refCollection !== collection) {
        emit(f.refCollection!, [...stack, collection]);
      }
    }
    done.add(collection);
    const item: Json = { collection, key: keyOf(collection) };
    const custom = manifest.dataSchema.collections[collection]?.example;
    if (custom) {
      Object.assign(item, custom);
    } else {
      for (const f of format.fields) {
        if (!f.required) continue;
        const v = valueFor(f, format.label, keyOf);
        if (v !== undefined) item[f.name] = v;
      }
    }
    items.push(item);
  };
  for (const collection of apiCollections(manifest)) emit(collection, []);
  return items;
}
