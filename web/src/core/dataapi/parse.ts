/**
 * JSON in the import format → `ImportCandidate`s for the shared preview / commit / undo flow.
 * Everything is checked against the collection's real Zod schema; problems are reported per entry
 * (German, without echoing the values) so the sender can correct just those and send again.
 * Text stays plain text: nothing here renders or executes content.
 */
import type { ZodIssue } from 'zod';
import type { ImportCandidate, ImportParseResult } from '@/core/importer/types';
import type { ModuleManifest } from '@/core/modules/types';
import { CURRENCY, parseMoney } from '@/core/money';
import { t } from '@/strings';
import { describeCollection, hasMoney, type CollectionFormat, type FieldFormat } from './format';
import { apiCollections } from './scope';

export const MAX_ITEMS = 500;

type Json = Record<string, unknown>;

export interface RefEntry {
  id: string;
  title: string;
}

/** Read access to what is already stored; the only thing parsing needs from the database. */
export interface RefLookup {
  /** Active entries of a collection of the module. */
  entries(collection: string): Promise<RefEntry[]>;
}

export interface ParseOptions {
  batchId: string;
  lookup: RefLookup;
  /** Values the sender cannot know (default list, main account); see `contributions.aiCreateDefaults`. */
  defaults?: (collection: string) => Promise<Record<string, unknown>>;
}

export class ImportJsonError extends Error {
  constructor(readonly text: string) {
    super(text);
  }
}

export const normalizeText = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase();

/** Accepts `[…]` or `{ "items": […] }`. */
export function readItems(text: string): unknown[] {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ImportJsonError(t.dataApi.notJson);
  }
  const items = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as Json).items)
      ? ((value as Json).items as unknown[])
      : undefined;
  if (!items) throw new ImportJsonError(t.dataApi.notList);
  if (items.length === 0) throw new ImportJsonError(t.dataApi.empty);
  if (items.length > MAX_ITEMS) throw new ImportJsonError(t.dataApi.tooMany(MAX_ITEMS));
  return items;
}

function toMinor(v: unknown): number | undefined {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return undefined;
    const minor = Math.round(v * 100);
    return Math.abs(v * 100 - minor) < 1e-6 && Number.isSafeInteger(minor) ? minor : undefined;
  }
  if (typeof v === 'string') return parseMoney(v, { allowNegative: true });
  return undefined;
}

const TYPE_DE: Record<string, string> = {
  string: 'Text',
  number: 'Zahl',
  int: 'ganze Zahl',
  boolean: 'Ja/Nein',
  array: 'Liste',
  object: 'Objekt',
};

function issueText(issue: ZodIssue, nameOf: (storeName: string) => string): string {
  const path = issue.path.map(String);
  if (path[0]) path[0] = nameOf(path[0]);
  const where = path.join('.');
  let what: string;
  const anyIssue = issue as unknown as Record<string, unknown>;
  if (issue.code === 'invalid_type') {
    what = /received undefined/.test(issue.message)
      ? t.dataApi.missing
      : t.dataApi.expected(TYPE_DE[String(anyIssue.expected)] ?? String(anyIssue.expected));
  } else if (issue.code === 'invalid_value' && Array.isArray(anyIssue.values)) {
    what = t.dataApi.oneOf((anyIssue.values as unknown[]).map(String).join(', '));
  } else if (issue.code === 'invalid_format') {
    what = t.dataApi.badFormat;
  } else if (issue.code === 'too_small' || issue.code === 'too_big') {
    what = t.dataApi.outOfRange;
  } else {
    what = issue.message;
  }
  return where ? `${where}: ${what}` : what;
}

/** Stable text for duplicate detection; the same for a candidate and for the stored record. */
export function canonicalKey(
  format: CollectionFormat,
  data: Record<string, unknown>,
  refTitle: (field: FieldFormat, id: string) => string,
): string {
  const parts: [string, unknown][] = [];
  for (const f of [...format.fields].sort((a, b) => a.storeName.localeCompare(b.storeName))) {
    const v = data[f.storeName];
    if (v === undefined || v === null) continue;
    const norm =
      f.kind === 'ref' && typeof v === 'string'
        ? normalizeText(refTitle(f, v))
        : typeof v === 'string'
          ? normalizeText(v)
          : v;
    parts.push([f.storeName, norm]);
  }
  return JSON.stringify(parts);
}

/** id → title of a collection, for `canonicalKey`. */
export async function titleIndex(
  lookup: RefLookup,
  collection: string,
): Promise<Map<string, string>> {
  return new Map((await lookup.entries(collection)).map((e) => [e.id, e.title]));
}

interface Draft {
  index: number;
  raw: Json;
  collection?: string;
  key?: string;
  id: string;
  errors: string[];
}

const META_KEYS = ['collection', 'key', 'currency'];

export async function buildCandidates(
  manifest: ModuleManifest,
  items: unknown[],
  opts: ParseOptions,
): Promise<ImportParseResult> {
  const allowed = apiCollections(manifest);
  const onlyOne = allowed.length === 1 ? allowed[0] : undefined;
  const drafts: Draft[] = [];
  const keys = new Map<string, Draft>();

  // Pass 1: structure, collection, batch keys.
  items.forEach((raw, index) => {
    const draft: Draft = {
      index,
      raw: (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Json,
      id: `imp-${opts.batchId}-${index}`,
      errors: [],
    };
    drafts.push(draft);
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      draft.errors.push(t.dataApi.itemNotObject);
      return;
    }
    const c = draft.raw.collection ?? onlyOne;
    if (typeof c !== 'string') draft.errors.push(t.dataApi.collectionMissing);
    else if (!allowed.includes(c)) draft.errors.push(t.dataApi.unknownCollection(allowed));
    else draft.collection = c;
    if (draft.raw.key !== undefined) {
      if (typeof draft.raw.key !== 'string' || draft.raw.key === '') {
        draft.errors.push(t.dataApi.badKey);
      } else if (keys.has(draft.raw.key)) {
        draft.errors.push(t.dataApi.duplicateKey);
      } else {
        draft.key = draft.raw.key;
        keys.set(draft.key, draft);
      }
    }
    if ('id' in draft.raw) draft.errors.push(t.dataApi.idNotAllowed);
  });

  const titleOfDraft = (d: Draft): string | undefined => {
    if (!d.collection) return undefined;
    const tf = describeCollection(manifest, d.collection).titleField;
    const v = tf ? d.raw[tf] : undefined;
    return typeof v === 'string' ? v : undefined;
  };
  const batchTitles = new Map(
    drafts.flatMap((d) => {
      const title = titleOfDraft(d);
      return title === undefined ? [] : [[d.id, title] as const];
    }),
  );

  const cache = new Map<string, RefEntry[]>();
  const entriesOf = async (collection: string) => {
    let list = cache.get(collection);
    if (!list) {
      list = await opts.lookup.entries(collection);
      cache.set(collection, list);
    }
    return list;
  };

  const candidates: ImportCandidate[] = [];
  for (const draft of drafts) {
    if (!draft.collection) {
      candidates.push(invalid(draft, '', `${t.dataApi.item(draft.index + 1)}: ${draft.errors[0]}`));
      continue;
    }
    const collection = draft.collection;
    const format = describeCollection(manifest, collection);
    const def = manifest.dataSchema.collections[collection]!;
    const errors = [...draft.errors];
    const data: Record<string, unknown> = {};
    const refIds = new Map<string, string>();

    for (const [name, value] of Object.entries(draft.raw)) {
      if (META_KEYS.includes(name) || name === 'id' || value === undefined || value === null)
        continue;
      const field = format.fields.find((f) => f.name === name);
      if (!field) {
        errors.push(t.dataApi.unknownField(name));
        continue;
      }
      if (field.kind === 'money') {
        const minor = toMinor(value);
        if (minor === undefined) errors.push(`${name}: ${t.dataApi.badMoney}`);
        else data[field.storeName] = minor;
      } else if (field.kind === 'ref') {
        const resolved = await resolveRef(
          field,
          value,
          draft,
          keys,
          drafts,
          batchTitles,
          entriesOf,
        );
        if (typeof resolved === 'string') errors.push(`${name}: ${resolved}`);
        else {
          data[field.storeName] = resolved.id;
          refIds.set(field.storeName, resolved.id);
        }
      } else {
        data[field.storeName] = value;
      }
    }
    if ('currency' in draft.raw && draft.raw.currency !== null) {
      if (!hasMoney(format) || draft.raw.currency !== CURRENCY)
        errors.push(`currency: ${t.dataApi.badCurrency}`);
    }

    // Values the sender cannot know (default list, main account) – only for missing fields.
    const missing = format.fields.some((f) => f.required && data[f.storeName] === undefined);
    if (missing && opts.defaults && errors.length === 0) {
      const defaults = await opts.defaults(collection);
      for (const [k, v] of Object.entries(defaults)) if (!(k in data)) data[k] = v;
    }

    const parsed = errors.length === 0 ? def.schema.safeParse(data) : undefined;
    if (parsed && !parsed.success) {
      const nameOf = (s: string) => format.fields.find((f) => f.storeName === s)?.name ?? s;
      for (const issue of parsed.error.issues.slice(0, 3)) errors.push(issueText(issue, nameOf));
    }

    const clean =
      parsed?.success === true
        ? (Object.fromEntries(
            Object.entries(parsed.data as Record<string, unknown>).filter(
              ([, v]) => v !== undefined,
            ),
          ) as Record<string, unknown>)
        : data;
    const titles = new Map<string, Map<string, string>>();
    for (const f of format.fields) {
      if (f.kind !== 'ref' || !f.refCollection || titles.has(f.refCollection)) continue;
      const existing = new Map((await entriesOf(f.refCollection)).map((e) => [e.id, e.title]));
      titles.set(f.refCollection, existing);
    }
    const dedupeKey = canonicalKey(
      format,
      clean,
      (f, id) => batchTitles.get(id) ?? titles.get(f.refCollection ?? '')?.get(id) ?? id,
    );
    const titleField = format.titleField;
    const label = String(
      (titleField && clean[titleField]) ?? draft.raw[titleField ?? ''] ?? collection,
    );
    candidates.push({
      collection,
      id: draft.id,
      data: clean,
      label: label.length > 0 ? label : collection,
      detail: format.label,
      dedupeKey,
      error:
        errors.length > 0
          ? `${t.dataApi.item(draft.index + 1)}: ${errors.slice(0, 3).join('; ')}`
          : undefined,
    });
  }
  return { candidates, notes: [] };
}

function invalid(draft: Draft, collection: string, error: string): ImportCandidate {
  return {
    collection,
    id: draft.id,
    data: {},
    label: t.dataApi.item(draft.index + 1),
    dedupeKey: `invalid:${draft.index}`,
    error,
  };
}

async function resolveRef(
  field: FieldFormat,
  value: unknown,
  self: Draft,
  keys: Map<string, Draft>,
  drafts: Draft[],
  batchTitles: Map<string, string>,
  entriesOf: (collection: string) => Promise<RefEntry[]>,
): Promise<{ id: string } | string> {
  if (typeof value !== 'string' || value === '') return t.dataApi.expected(TYPE_DE.string!);
  const target = field.refCollection!;
  if (value.startsWith('@')) {
    const hit = keys.get(value.slice(1));
    if (!hit) return t.dataApi.keyNotFound;
    if (hit.collection !== target) return t.dataApi.refWrongCollection(target);
    if (hit === self) return t.dataApi.refSelf;
    return { id: hit.id };
  }
  const existing = await entriesOf(target);
  const byId = existing.find((e) => e.id === value);
  if (byId) return { id: byId.id };
  const wanted = normalizeText(value);
  const inBatch = drafts.filter(
    (d) =>
      d !== self &&
      d.collection === target &&
      normalizeText(batchTitles.get(d.id) ?? '') === wanted,
  );
  const stored = existing.filter((e) => normalizeText(e.title) === wanted);
  const matches = [...inBatch.map((d) => d.id), ...stored.map((e) => e.id)];
  if (matches.length === 1) return { id: matches[0]! };
  return matches.length === 0 ? t.dataApi.refNotFound(target) : t.dataApi.refAmbiguous(target);
}
