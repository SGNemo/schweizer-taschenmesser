/**
 * Turns a proposed op into something the preview can show and the commit can write. Everything
 * that comes from a stage (rules, local model, cloud) passes through here: module and action must
 * exist and be enabled, fields come from the action's whitelist, values are coerced, the record is
 * validated with the collection's real Zod schema. Missing required fields and an unclear target
 * are *not* errors – the preview asks for them. Anything the schemas forbid throws `AiQueryError`.
 */
import { tableName } from '@/core/db/schema';
import type { AiActionDef, ModuleManifest } from '@/core/modules/types';
import { recurrenceSchema } from '@/core/recurrence/types';
import { formatFieldValue, fieldLabel } from '../query/format';
import { AiQueryError, type ExecContext } from '../query/types';
import { coerceValue, findField, findModule } from '../query/validate';
import { aiModules } from '../scope';
import { findTarget } from './targets';
import type { DiffLine, PreparedOp, ProposedOp } from './types';

export function findAction(
  manifest: ModuleManifest,
  action: string,
): { id: string; def: AiActionDef } {
  const actions = manifest.aiSchema?.actions ?? {};
  const squash = (s: string) => s.replace(/[_\s-]/g, '').toLowerCase();
  const id = Object.keys(actions).find((k) => squash(k) === squash(action));
  if (!id) throw new AiQueryError('unknown-action', `${manifest.id}.${action}`);
  return { id, def: actions[id]! };
}

/** Coerces the proposed values of the fields the action may set. */
function coerceData(
  manifest: ModuleManifest,
  def: AiActionDef,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const schema = manifest.aiSchema!.collections[def.collection]!;
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null || value === '') continue;
    const { field, type } = findField(schema, key);
    if (!def.fields?.includes(field))
      throw new AiQueryError('unknown-field', `${def.label}: ${key}`);
    if (type === 'recurrence') {
      const rule = recurrenceSchema.safeParse(value);
      if (!rule.success) throw new AiQueryError('bad-value', `${field}=${JSON.stringify(value)}`);
      data[field] = rule.data;
    } else if (type === 'tags') {
      data[field] = Array.isArray(value)
        ? value.map(String)
        : String(value)
            .split(/[,;]/)
            .map((s) => s.trim())
            .filter(Boolean);
    } else {
      data[field] = coerceValue(type, value, field);
    }
  }
  return data;
}

const without = (o: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

function diff(
  manifest: ModuleManifest,
  collection: string,
  patch: Record<string, unknown>,
  before?: Record<string, unknown>,
): DiffLine[] {
  const fields = manifest.aiSchema!.collections[collection]!.fields;
  return Object.keys(patch).flatMap((field) => {
    const type = fields[field];
    if (!type) return [];
    const to = formatFieldValue(type, patch[field]);
    const from = before ? formatFieldValue(type, before[field]) : undefined;
    if (to === undefined && from === undefined) return [];
    return [
      {
        field,
        label: fieldLabel(field),
        ...(from !== undefined ? { from } : {}),
        ...(to !== undefined ? { to } : {}),
      },
    ];
  });
}

const issueFields = (error: { issues: { path: PropertyKey[] }[] }): string[] => [
  ...new Set(error.issues.map((i) => String(i.path[0] ?? ''))),
];

export async function prepareOp(
  op: ProposedOp,
  index: number,
  ctx: ExecContext,
): Promise<PreparedOp> {
  const manifests = aiModules(ctx.manifests);
  const manifest = findModule(op.module, { manifests, known: aiModules(ctx.known) });
  const { id: actionId, def } = findAction(manifest, op.action);
  const schema = manifest.aiSchema!.collections[def.collection]!;
  const collectionDef = manifest.dataSchema.collections[def.collection];
  if (!collectionDef)
    throw new AiQueryError('unknown-collection', `${manifest.id}.${def.collection}`);

  const base = {
    index,
    source: op,
    module: manifest.id,
    moduleName: manifest.name,
    moduleIcon: manifest.icon,
    action: actionId,
    actionLabel: def.label,
    kind: def.kind,
    collection: def.collection,
    collectionLabel: schema.label,
    candidates: [],
    missing: [] as string[],
    needsTarget: false,
  };

  if (def.kind === 'create') {
    const data = coerceData(manifest, def, op.data ?? {});
    const loadDefaults = manifest.contributions?.aiCreateDefaults;
    if (loadDefaults) {
      const defaults = await (await loadDefaults()).default(def.collection);
      for (const [k, v] of Object.entries(defaults)) if (!(k in data)) data[k] = v;
    }
    const missing = (def.required ?? []).filter((f) => data[f] === undefined);
    const parsed = collectionDef.schema.safeParse(data);
    let clean = data;
    let error: string | undefined;
    if (parsed.success) {
      clean = without(parsed.data as Record<string, unknown>);
    } else {
      for (const f of issueFields(parsed.error)) {
        if (data[f] !== undefined) throw new AiQueryError('invalid-entry', f);
        if (!missing.includes(f)) {
          if (def.fields?.includes(f)) missing.push(f);
          else error = f; // e.g. no default account – nothing the user can type here
        }
      }
    }
    const lines = diff(
      manifest,
      def.collection,
      Object.fromEntries(
        Object.entries(schema.fields).flatMap(([f]) => (f in clean ? [[f, clean[f]]] : [])),
      ),
    );
    return {
      ...base,
      data: clean,
      lines,
      missing,
      error: error ? `invalid-entry: ${error}` : undefined,
      ready: missing.length === 0 && !error,
    };
  }

  // update / transition / delete act on an existing entry.
  const patch =
    def.kind === 'transition'
      ? { ...def.set }
      : def.kind === 'update'
        ? coerceData(manifest, def, op.data ?? {})
        : {};
  const table = ctx.database.table<
    Record<string, unknown> & { id: string; deletedAt: number | null },
    string
  >(tableName(manifest.id, def.collection));
  let target: Record<string, unknown> | undefined;
  let candidates: PreparedOp['candidates'] = [];
  if (op.target?.id) {
    const row = await table.get(op.target.id);
    if (row && row.deletedAt === null) target = row;
  } else if (op.target?.title) {
    const found = await findTarget(
      ctx.database,
      manifest.id,
      def.collection,
      schema.titleField,
      op.target.title,
      [schema.label, ...(def.parse?.keywords ?? [])],
    );
    candidates = found.candidates;
    if (found.match) target = (await table.get(found.match.id)) ?? undefined;
  }

  const missing = def.kind === 'update' && Object.keys(patch).length === 0 ? ['change'] : [];
  if (!target) {
    return {
      ...base,
      candidates,
      data: patch,
      lines: diff(manifest, def.collection, patch),
      missing,
      needsTarget: true,
      ready: false,
    };
  }
  const targetTitle = String(target[schema.titleField] ?? '');
  if (def.kind === 'delete') {
    const before = stripEnvelope(target);
    const lines = Object.keys(schema.fields).flatMap((f) => {
      const v = formatFieldValue(schema.fields[f]!, target![f]);
      return v === undefined ? [] : [{ field: f, label: fieldLabel(f), from: v }];
    });
    return {
      ...base,
      targetId: String(target.id),
      targetTitle,
      candidates,
      data: {},
      before,
      lines,
      missing: [],
      ready: true,
    };
  }
  const before = Object.fromEntries(Object.keys(patch).map((k) => [k, target![k]]));
  const merged = without({ ...stripEnvelope(target), ...patch });
  const parsed = collectionDef.schema.safeParse(merged);
  if (!parsed.success)
    throw new AiQueryError('invalid-entry', issueFields(parsed.error).join(', '));
  const lines = diff(manifest, def.collection, patch, before).filter((l) => l.from !== l.to);
  return {
    ...base,
    targetId: String(target.id),
    targetTitle,
    candidates,
    data: patch,
    before,
    lines,
    missing,
    ready: missing.length === 0 && lines.length > 0,
    ...(lines.length === 0 && missing.length === 0 ? { error: 'no-change' } : {}),
  };
}

const ENVELOPE = new Set(['id', 'createdAt', 'updatedAt', 'deviceId', 'deletedAt', '_f']);
const stripEnvelope = (row: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(row).filter(([k]) => !ENVELOPE.has(k)));

export async function prepareProposal(
  ops: readonly ProposedOp[],
  ctx: ExecContext,
): Promise<PreparedOp[]> {
  const out: PreparedOp[] = [];
  for (const [i, op] of ops.entries()) out.push(await prepareOp(op, i, ctx));
  return out;
}
