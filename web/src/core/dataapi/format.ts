/**
 * The import format, derived from the collection's Zod schema – there is no second, hand-kept
 * schema. `z.toJSONSchema(…, { io: 'input' })` gives the field list; a few generic conventions turn
 * the stored shape into something an AI can produce easily:
 *  - `fooMinor` (integer cents) becomes `foo`, a number in euro (plus an optional `currency`).
 *  - `fooId` refers to another collection of the module (or the collection itself for `parentId`);
 *    it takes an existing id, the title of an existing entry, or `@key` of an entry in the same batch.
 *  - technical fields (`order`, or `.meta({ internal: true })`) are not part of the format.
 *  - `id` and the sync envelope are never accepted – the app assigns them.
 */
import { z } from 'zod';
import type { ModuleManifest } from '@/core/modules/types';
import { apiCollections } from './scope';

export type FieldKind = 'plain' | 'money' | 'ref';

export interface FieldFormat {
  /** Name in the import format. */
  name: string;
  /** Name in the stored record. */
  storeName: string;
  kind: FieldKind;
  /** `ref`: collection of the same module the value points to. */
  refCollection?: string;
  required: boolean;
  /** JSON Schema of the field as it appears in the import format. */
  schema: Record<string, unknown>;
}

export interface CollectionFormat {
  moduleId: string;
  collection: string;
  /** Field shown as headline (aiSchema title field, else `title` / `name`). */
  titleField?: string;
  /** Short German label from the aiSchema, else the collection name. */
  label: string;
  fields: FieldFormat[];
  /** Import-format fields that the app fills in itself, such as technical ones. */
  internal: string[];
}

export const INTERNAL_BY_NAME: readonly string[] = ['order'];

type JsonObject = Record<string, unknown>;

function jsonSchemaOf(schema: z.ZodObject): JsonObject {
  return z.toJSONSchema(schema, {
    io: 'input',
    unrepresentable: 'any',
    target: 'draft-2020-12',
  }) as JsonObject;
}

/** Collection an `xxxId` field points to, or undefined when the name is not a reference. */
export function refTarget(
  manifest: ModuleManifest,
  collection: string,
  storeName: string,
): string | undefined {
  if (!storeName.endsWith('Id') || storeName === 'Id') return undefined;
  const base = storeName.slice(0, -2);
  if (base === 'parent') return collection;
  const collections = apiCollections(manifest);
  return collections.includes(base) && base !== collection ? base : undefined;
}

export function titleFieldOf(manifest: ModuleManifest, collection: string): string | undefined {
  const declared = manifest.aiSchema?.collections[collection]?.titleField;
  if (declared) return declared;
  const shape = manifest.dataSchema.collections[collection]?.schema.shape ?? {};
  return ['title', 'name', 'payee'].find((k) => k in shape);
}

const cache = new WeakMap<ModuleManifest, Map<string, CollectionFormat>>();

export function describeCollection(manifest: ModuleManifest, collection: string): CollectionFormat {
  const perModule = cache.get(manifest) ?? new Map<string, CollectionFormat>();
  cache.set(manifest, perModule);
  const cached = perModule.get(collection);
  if (cached) return cached;

  const def = manifest.dataSchema.collections[collection];
  if (!def) throw new Error(`unknown collection ${manifest.id}.${collection}`);
  const js = jsonSchemaOf(def.schema);
  const properties = (js.properties ?? {}) as Record<string, JsonObject>;
  const required = new Set((js.required ?? []) as string[]);

  const fields: FieldFormat[] = [];
  const internal: string[] = [];
  for (const [storeName, prop] of Object.entries(properties)) {
    if (INTERNAL_BY_NAME.includes(storeName) || prop.internal === true) {
      internal.push(storeName);
      continue;
    }
    const { internal: _drop, ...clean } = prop;
    void _drop;
    const isMoney = storeName.endsWith('Minor') && prop.type === 'integer';
    const refCollection = refTarget(manifest, collection, storeName);
    if (isMoney) {
      const { minimum, maximum, ...rest } = clean;
      void minimum;
      void maximum;
      fields.push({
        name: storeName.slice(0, -'Minor'.length),
        storeName,
        kind: 'money',
        required: required.has(storeName),
        schema: {
          ...rest,
          type: 'number',
          multipleOf: 0.01,
          description:
            `${typeof clean.description === 'string' ? `${clean.description} ` : ''}Betrag in Euro, höchstens zwei Nachkommastellen.`.trim(),
        },
      });
    } else if (refCollection) {
      fields.push({
        name: storeName,
        storeName,
        kind: 'ref',
        refCollection,
        required: required.has(storeName),
        schema: {
          type: 'string',
          description: `Verweis auf „${refCollection}“: vorhandene ID, Titel eines vorhandenen Eintrags oder @key eines Eintrags aus derselben Sendung.`,
        },
      });
    } else {
      fields.push({
        name: storeName,
        storeName,
        kind: 'plain',
        required: required.has(storeName),
        schema: clean,
      });
    }
  }

  const format: CollectionFormat = {
    moduleId: manifest.id,
    collection,
    titleField: titleFieldOf(manifest, collection),
    label: manifest.aiSchema?.collections[collection]?.label ?? collection,
    fields,
    internal,
  };
  perModule.set(collection, format);
  return format;
}

export const hasMoney = (format: CollectionFormat): boolean =>
  format.fields.some((f) => f.kind === 'money');

/** JSON Schema of one import item (`collection` discriminator, optional `key`, the fields). */
export function itemJsonSchema(format: CollectionFormat): JsonObject {
  const properties: Record<string, unknown> = {
    collection: { const: format.collection },
    key: {
      type: 'string',
      description:
        'Optional Name dieses Eintrags; andere Einträge der Sendung verweisen mit @key darauf.',
    },
  };
  for (const f of format.fields) properties[f.name] = f.schema;
  if (hasMoney(format)) {
    properties.currency = { const: 'EUR', description: 'Währung der Beträge; nur EUR.' };
  }
  return {
    type: 'object',
    title: format.label,
    properties,
    required: ['collection', ...format.fields.filter((f) => f.required).map((f) => f.name)],
    additionalProperties: false,
  };
}
