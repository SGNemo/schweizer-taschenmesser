/**
 * Validation of model/parser output against the modules' `aiSchema`s: module and collection must
 * exist and be enabled, fields come from a whitelist, operators must fit the field type and
 * values are coerced to the stored representation. Small slips (letter case, snake_case field
 * names, "true" as string) are repaired locally instead of costing another model call.
 */
import type {
  AiCollectionSchema,
  AiFieldType,
  ModuleAiSchema,
  ModuleManifest,
} from '@/core/modules/types';
import { DATE_RE } from '@/core/time/dates';
import type { Filter, Operator, Query } from './schema';
import { AiQueryError, type ExecContext } from './types';

const squash = (s: string): string => s.replace(/[_\s-]/g, '').toLowerCase();

export interface ResolvedCollection {
  manifest: ModuleManifest;
  collection: string;
  schema: AiCollectionSchema;
}

export function findModule(
  id: string,
  ctx: Pick<ExecContext, 'manifests' | 'known'>,
): ModuleManifest {
  const wanted = id.trim().toLowerCase();
  const active = ctx.manifests.find((m) => m.id === wanted);
  if (active) return active;
  if (ctx.known.some((m) => m.id === wanted)) throw new AiQueryError('inactive-module', wanted);
  throw new AiQueryError('unknown-module', id);
}

export function findCollection(
  manifest: ModuleManifest,
  name: string,
): { collection: string; schema: AiCollectionSchema } {
  const ai: ModuleAiSchema = manifest.aiSchema;
  const key = Object.keys(ai.collections).find((c) => squash(c) === squash(name));
  if (!key) throw new AiQueryError('unknown-collection', `${manifest.id}.${name}`);
  return { collection: key, schema: ai.collections[key]! };
}

export function resolveCollection(
  moduleId: string,
  collection: string,
  ctx: Pick<ExecContext, 'manifests' | 'known'>,
): ResolvedCollection {
  const manifest = findModule(moduleId, ctx);
  return { manifest, ...findCollection(manifest, collection) };
}

export function findField(
  schema: AiCollectionSchema,
  name: string,
): { field: string; type: AiFieldType } {
  const key = Object.keys(schema.fields).find((f) => squash(f) === squash(name));
  if (!key) throw new AiQueryError('unknown-field', name);
  return { field: key, type: schema.fields[key]! };
}

const baseType = (type: AiFieldType): string => (type.startsWith('enum:') ? 'enum' : type);

export function enumValues(type: AiFieldType): string[] {
  return type.startsWith('enum:') ? type.slice(5).split('|') : [];
}

const OPS_BY_TYPE: Record<string, readonly Operator[]> = {
  text: ['eq', 'ne', 'contains', 'in'],
  num: ['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'between', 'in'],
  money: ['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'between', 'in'],
  ts: ['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'between'],
  date: ['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'between', 'in'],
  bool: ['eq', 'ne'],
  enum: ['eq', 'ne', 'in'],
  tags: ['contains'],
  recurrence: [],
};

export const isSortable = (type: AiFieldType): boolean => !['tags', 'recurrence'].includes(type);

/** Coerces one raw value to the field's stored type; throws `bad-value` when impossible. */
export function coerceValue(
  type: AiFieldType,
  raw: unknown,
  field: string,
): string | number | boolean {
  const bad = () => new AiQueryError('bad-value', `${field}=${JSON.stringify(raw)}`);
  switch (baseType(type)) {
    case 'text':
    case 'tags':
      if (typeof raw === 'string') return raw;
      if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
      throw bad();
    case 'num':
    case 'money':
    case 'ts': {
      const n = typeof raw === 'string' ? Number(raw.trim().replace(',', '.')) : raw;
      if (typeof n !== 'number' || !Number.isFinite(n)) throw bad();
      if (baseType(type) === 'money' && !Number.isInteger(n)) throw bad(); // cents only
      return n;
    }
    case 'date':
      if (typeof raw === 'string' && DATE_RE.test(raw.trim())) return raw.trim();
      throw bad();
    case 'bool': {
      if (typeof raw === 'boolean') return raw;
      const s = String(raw).trim().toLowerCase();
      if (['true', 'ja', 'yes', '1'].includes(s)) return true;
      if (['false', 'nein', 'no', '0'].includes(s)) return false;
      throw bad();
    }
    case 'enum': {
      const hit = enumValues(type).find((v) => v === String(raw).trim().toLowerCase());
      if (hit) return hit;
      throw bad();
    }
    default:
      throw bad();
  }
}

function validateFilter(schema: AiCollectionSchema, f: Filter): Filter {
  const { field, type } = findField(schema, f.field);
  if (!OPS_BY_TYPE[baseType(type)]!.includes(f.op)) {
    throw new AiQueryError('bad-operator', `${f.op} on ${field}:${type}`);
  }
  const list = Array.isArray(f.value) ? f.value : [f.value];
  if (f.op === 'between' && list.length !== 2)
    throw new AiQueryError('bad-value', `${field} between`);
  if (f.op !== 'in' && f.op !== 'between' && Array.isArray(f.value)) {
    throw new AiQueryError('bad-value', `${field} needs a single value`);
  }
  if (f.op === 'in' && list.length === 0) throw new AiQueryError('bad-value', `${field} in []`);
  const coerced = list.map((v) => coerceValue(type, v, field));
  const value = f.op === 'in' || f.op === 'between' ? coerced : coerced[0]!;
  return { field, op: f.op, value };
}

export interface ValidatedQuery {
  query: Query;
  resolved: ResolvedCollection;
}

/** Returns the query with canonical module/collection/field names, or throws `AiQueryError`. */
export function validateQuery(query: Query, ctx: ExecContext): ValidatedQuery {
  const resolved = resolveCollection(query.module, query.collection, ctx);
  const { schema } = resolved;
  const filters = query.filters.map((f) => validateFilter(schema, f));

  let range = query.range;
  if (range) {
    const name = range.field ?? schema.dateField;
    if (!name) throw new AiQueryError('no-date-field', resolved.collection);
    const { field, type } = findField(schema, name);
    if (type !== 'date') throw new AiQueryError('no-date-field', `${field}:${type}`);
    range = { ...range, field };
  }

  let sort = query.sort;
  if (sort) {
    const { field, type } = findField(schema, sort.field);
    if (!isSortable(type)) throw new AiQueryError('bad-operator', `sort on ${field}:${type}`);
    sort = { ...sort, field };
  }

  let aggregate = query.aggregate;
  if (aggregate?.startsWith('sum:')) {
    const { field, type } = findField(schema, aggregate.slice(4));
    if (!['num', 'money'].includes(type))
      throw new AiQueryError('bad-aggregate', `${field}:${type}`);
    aggregate = `sum:${field}`;
  }

  return {
    query: {
      ...query,
      module: resolved.manifest.id,
      collection: resolved.collection,
      filters,
      range,
      sort,
      aggregate,
    },
    resolved,
  };
}
