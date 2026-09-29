/**
 * Runs validated intents locally against the module tables. No result goes back to the model:
 * answers are rendered straight from the data, so a question costs at most one model call.
 */
import { formatMoney } from '@/core/money';
import { collectCalendarItems } from '@/core/modules/contributions';
import type { AiFieldType } from '@/core/modules/types';
import { tableName } from '@/core/db/schema';
import { daysBetween } from '@/core/time/dates';
import { t } from '@/strings';
import { prepareCreate } from './create';
import { fieldLabel } from './format';
import { toResultRow } from './rows';
import { resolveRange } from './range';
import type { Agenda, Filter, Intent, Query } from './schema';
import { AiQueryError, type AiResult, type ExecContext } from './types';
import { findModule, isSortable, validateQuery } from './validate';
import { fold } from '../text';
import { searchText } from '../search/fulltext';

type Row = Record<string, unknown> & { id: string; deletedAt: number | null };

const MAX_AGENDA_DAYS = 366;
function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return 1; // missing values last
  if (b === undefined || b === null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b), 'de');
}

/** Does the stored value satisfy the (already validated) filter? */
export function matchesFilter(
  row: Record<string, unknown>,
  filter: Filter,
  type: AiFieldType,
): boolean {
  const raw = row[filter.field];
  // A missing boolean means false (schemas default it), missing anything else never matches.
  const value = raw === undefined && type === 'bool' ? false : raw;
  const target = filter.value;
  const isText = type === 'text' || type === 'tags';
  const norm = (v: unknown) => (isText ? fold(String(v)) : v);
  switch (filter.op) {
    case 'eq':
      return value !== undefined && norm(value) === norm(target);
    case 'ne':
      return value === undefined || norm(value) !== norm(target);
    case 'in':
      return value !== undefined && (target as unknown[]).some((v) => norm(v) === norm(value));
    case 'contains': {
      if (value === undefined) return false;
      const hay = Array.isArray(value) ? value.map((v) => fold(String(v))) : [fold(String(value))];
      const needle = fold(String(target));
      return type === 'tags' ? hay.includes(needle) : hay.some((h) => h.includes(needle));
    }
    case 'between': {
      if (value === undefined) return false;
      const [lo, hi] = target as [unknown, unknown];
      return compareValues(value, lo) >= 0 && compareValues(value, hi) <= 0;
    }
    default: {
      if (value === undefined) return false;
      const c = compareValues(value, target);
      return filter.op === 'lt'
        ? c < 0
        : filter.op === 'lte'
          ? c <= 0
          : filter.op === 'gt'
            ? c > 0
            : c >= 0;
    }
  }
}

async function loadRows(ctx: ExecContext, module: string, collection: string): Promise<Row[]> {
  const rows = await ctx.database.table<Row, string>(tableName(module, collection)).toArray();
  return rows.filter((r) => r.deletedAt === null);
}

async function runQuery(raw: Query, ctx: ExecContext): Promise<AiResult> {
  const { query, resolved } = validateQuery(raw, ctx);
  const { manifest, collection, schema } = resolved;
  let rows = await loadRows(ctx, manifest.id, collection);

  for (const f of query.filters) {
    const type = schema.fields[f.field]!;
    rows = rows.filter((r) => matchesFilter(r, f, type));
  }
  if (query.range && query.range.field) {
    const { from, to } = resolveRange(query.range, ctx.today);
    const field = query.range.field;
    rows = rows.filter((r) => {
      const v = r[field];
      return typeof v === 'string' && (!from || v >= from) && (!to || v <= to);
    });
  }

  const heading = `${schema.label} · ${manifest.name}`;
  if (query.aggregate === 'count') {
    return {
      kind: 'aggregate',
      heading,
      value: String(rows.length),
      note: t.ai.countNote(rows.length),
    };
  }
  if (query.aggregate) {
    const field = query.aggregate.slice(4);
    const type = schema.fields[field]!;
    const sum = rows.reduce(
      (acc, r) => acc + (typeof r[field] === 'number' ? (r[field] as number) : 0),
      0,
    );
    return {
      kind: 'aggregate',
      heading,
      value: type === 'money' ? formatMoney(sum) : String(sum),
      note: t.ai.sumNote(fieldLabel(field), rows.length),
    };
  }

  const sortField = query.sort?.field ?? schema.dateField ?? schema.titleField;
  const dir = query.sort?.dir ?? 'asc';
  if (isSortable(schema.fields[sortField]!)) {
    rows = [...rows].sort(
      (a, b) => compareValues(a[sortField], b[sortField]) * (dir === 'desc' ? -1 : 1),
    );
  }
  return {
    kind: 'rows',
    heading,
    total: rows.length,
    rows: rows.slice(0, query.limit).map((r) => toResultRow(manifest, collection, r)),
  };
}

async function runAgenda(agenda: Agenda, ctx: ExecContext): Promise<AiResult> {
  if (agenda.relative === 'overdue')
    throw new AiQueryError('bad-value', 'agenda cannot be overdue');
  const range = resolveRange(agenda, ctx.today);
  const from = range.from ?? range.to!;
  const to = range.to ?? range.from!;
  if (to < from || daysBetween(from, to) > MAX_AGENDA_DAYS) {
    throw new AiQueryError('bad-value', `agenda ${from}..${to}`);
  }
  const sources = agenda.sources?.map((id) => findModule(id, ctx));
  const items = await collectCalendarItems({ from, to }, sources ?? ctx.manifests);
  return { kind: 'agenda', from, to, items };
}

async function runComputed(module: string, name: string, ctx: ExecContext): Promise<AiResult> {
  const manifest = findModule(module, ctx);
  const known = Object.keys(manifest.aiSchema.computed ?? {}).find(
    (n) => n.toLowerCase() === name.trim().toLowerCase(),
  );
  const load = manifest.contributions?.aiComputed;
  if (!known || !load) throw new AiQueryError('unknown-computed', `${manifest.id}.${name}`);
  const result = await (await load()).default(known, { today: ctx.today });
  if (!result) throw new AiQueryError('unknown-computed', `${manifest.id}.${name}`);
  return { kind: 'computed', ...result };
}

/** Executes a validated intent. Throws `AiQueryError` for anything the schemas do not allow. */
export async function executeIntent(intent: Intent, ctx: ExecContext): Promise<AiResult> {
  switch (intent.type) {
    case 'query':
      return runQuery(intent.query, ctx);
    case 'agenda':
      return runAgenda(intent.agenda, ctx);
    case 'computed':
      return runComputed(intent.module, intent.name, ctx);
    case 'create':
      return { kind: 'create', prepared: await prepareCreate(intent, ctx) };
    case 'fulltext':
      return searchText(intent.text, ctx);
    case 'message':
      return { kind: 'message', text: intent.text };
  }
}
