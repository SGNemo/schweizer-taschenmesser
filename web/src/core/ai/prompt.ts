/**
 * What stage 2 sends to the model: instructions, the compact aiSchema of the *enabled* modules,
 * the tool definitions, and per request only the question and today's date. User data never
 * appears here – the model only chooses a structured query that the app runs locally.
 */
import type { AiCollectionSchema, ModuleManifest } from '@/core/modules/types';
import { formatDay } from '@/core/time/dates';
import {
  agendaSchema,
  computedSchema,
  createSchema,
  writeSchema,
  OPERATORS,
  querySchema,
  RELATIVE_RANGES,
  type Intent,
} from './query/schema';
import type { ToolDef } from './providers/types';
import { aiModules } from './scope';

function requiredFields(manifest: ModuleManifest, collection: string): Set<string> {
  const shape = manifest.dataSchema.collections[collection]?.schema.shape ?? {};
  return new Set(
    Object.entries(shape)
      .filter(
        ([, field]) =>
          !(field as { safeParse(v: unknown): { success: boolean } }).safeParse(undefined).success,
      )
      .map(([name]) => name),
  );
}

function collectionLine(manifest: ModuleManifest, name: string, c: AiCollectionSchema): string {
  const required = requiredFields(manifest, name);
  const fields = Object.entries(c.fields).map(([f, type]) => {
    const t = type.startsWith('enum:') ? `enum(${type.slice(5)})` : type;
    return `${f}:${t}${f === c.dateField ? '@' : ''}${required.has(f) ? '!' : ''}`;
  });
  return `  ${name}[${c.label}] ${fields.join(' ')}`;
}

/** Compact schema text of the given modules (this is what costs tokens). */
export function buildSchemaText(manifests: readonly ModuleManifest[]): string {
  return aiModules(manifests)
    .map((m) => {
      const lines = [`${m.id}: ${m.aiSchema.description}`];
      for (const [name, c] of Object.entries(m.aiSchema.collections)) {
        lines.push(collectionLine(m, name, c));
      }
      const computed = Object.entries(m.aiSchema.computed ?? {});
      if (computed.length > 0) {
        lines.push(`  computed: ${computed.map(([n, d]) => `${n} (${d})`).join('; ')}`);
      }
      return lines.join('\n');
    })
    .join('\n');
}

/** Modules the assistant may write to: they declare actions and the user has not switched them off. */
export function writableModules(
  manifests: readonly ModuleManifest[],
  off: readonly string[] = [],
): ModuleManifest[] {
  return aiModules(manifests).filter(
    (m) => Object.keys(m.aiSchema.actions ?? {}).length > 0 && !off.includes(m.id),
  );
}

/**
 * Compact action list sent to the cloud: `module: id(field!,field) id[transition] delete`, plus one
 * example taken from the first module's own `create` example. Field types are already in the schema text.
 */
export function buildActionText(writable: readonly ModuleManifest[], withExample = true): string {
  const lines = writable.map((m) => {
    const actions = Object.entries(m.aiSchema!.actions!).map(([id, a]) => {
      if (a.kind === 'delete') return `${id}[delete]`;
      if (a.kind === 'transition')
        return `${id}[sets ${Object.entries(a.set ?? {})
          .map(([k, v]) => `${k}=${String(v)}`)
          .join(',')}]`;
      const required = new Set(a.required ?? []);
      return `${id}(${(a.fields ?? []).map((f) => `${f}${required.has(f) ? '!' : ''}`).join(',')})`;
    });
    return `${m.id}: ${actions.join(' ')}`;
  });
  const sample = writable
    .flatMap((m) => Object.entries(m.aiSchema!.actions!).map(([id, a]) => ({ m, id, a })))
    .find((x) => x.a.kind === 'create' && x.a.examples[0]);
  if (sample && withExample) {
    const e = sample.a.examples[0]!;
    lines.push(
      `Example: "${e.input}" -> ${JSON.stringify({ ops: [{ module: sample.m.id, action: sample.id, data: e.output }] })}`,
    );
  }
  return lines.join('\n');
}

/**
 * What the model may do besides reading: `writable` modules get `propose_actions`; with none and no
 * `off` flag the older `create_entry` tool stays (modules without actions); `off` removes all writes.
 */
export interface WriteMode {
  writable: readonly ModuleManifest[];
  off?: boolean;
}

export function buildSystemPrompt(
  manifests: readonly ModuleManifest[],
  mode: WriteMode = { writable: [] },
): string {
  const { writable } = mode;
  const write = writable.length > 0;
  return [
    "You translate questions about a personal organiser app into ONE tool call. You cannot see the user's data; the app runs the call locally and shows the answer.",
    'Modules and collections (field:type, "@" = date field for ranges, "!" = required when creating):',
    buildSchemaText(manifests),
    'Rules:',
    `- Call exactly one tool. run_query: list/filter/count/sum entries of one collection. show_agenda: what happens in a date range across modules (includes recurring items) – use it for "what is due/on today, this week, …". run_computed: a named computed view. ${write ? 'propose_actions: when the user asks to add, change, delete or mark entries (several entries = several ops).' : mode.off ? 'You cannot add or change entries.' : 'create_entry: only when the user asks to add or be reminded of something.'}`,
    '- Dates are YYYY-MM-DD; prefer range.relative when it fits. Times are HH:mm. Weeks run Monday-Sunday. Money is integer cents (12,50 EUR = 1250). Only use listed fields; values of enum fields must be listed ones.',
    `- ${write ? "propose_actions: op = {module, action (listed below), data (only that action's fields; leave unknown ones out), target:{title} for update/delete/sets-actions = the words the user used for the entry, never invented}. The user confirms every op before anything is saved." : 'create_entry.data: only listed fields.'} recurrence = {freq: daily|weekly|monthly|yearly, interval?, byWeekday? (1=Mon..7=Sun), byMonthDay? (1-31, -1 = last day), monthOfYear? (1-12)}. Lists and accounts are filled in by the app.`,
    ...(write ? ['Actions (! = required):', buildActionText(writable)] : []),
    '- If no tool fits, answer with one short German sentence and call no tool.',
  ].join('\n');
}

export function buildUserMessage(question: string, today: string): string {
  return `Heute: ${today} (${formatDay(today, 'EEEE')})\nFrage: ${question.trim()}`;
}

const stringEnum = (values: readonly string[]) => ({ type: 'string', enum: [...values] });

export function buildTools(
  manifests: readonly ModuleManifest[],
  mode: WriteMode = { writable: [] },
): ToolDef[] {
  const { writable } = mode;
  manifests = aiModules(manifests);
  const ids = manifests.map((m) => m.id);
  const range = {
    relative: stringEnum(RELATIVE_RANGES),
    from: { type: 'string', description: 'YYYY-MM-DD' },
    to: { type: 'string', description: 'YYYY-MM-DD, inclusive' },
  };
  const tools: ToolDef[] = [
    {
      name: 'run_query',
      description: 'List, filter, count or sum entries of one collection.',
      input_schema: {
        type: 'object',
        properties: {
          module: stringEnum(ids),
          collection: { type: 'string' },
          filters: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                op: stringEnum(OPERATORS),
                value: { description: 'between/in take an array' },
              },
              required: ['field', 'op', 'value'],
            },
          },
          range: {
            type: 'object',
            description: 'Restricts a date field (default: the collection date field @).',
            properties: { field: { type: 'string' }, ...range },
          },
          sort: {
            type: 'object',
            properties: { field: { type: 'string' }, dir: stringEnum(['asc', 'desc']) },
            required: ['field'],
          },
          limit: { type: 'integer' },
          aggregate: { type: 'string', description: '"count" or "sum:<numeric field>"' },
        },
        required: ['module', 'collection'],
      },
    },
    {
      name: 'show_agenda',
      description:
        'Timeline of calendar entries, tasks, reminders, invoices and charges in a range.',
      input_schema: {
        type: 'object',
        properties: { ...range, sources: { type: 'array', items: stringEnum(ids) } },
      },
    },
  ];
  if (aiModules(manifests).some((m) => Object.keys(m.aiSchema.computed ?? {}).length > 0)) {
    tools.push({
      name: 'run_computed',
      description: 'A named computed view of a module (see "computed" above).',
      input_schema: {
        type: 'object',
        properties: { module: stringEnum(ids), name: { type: 'string' } },
        required: ['module', 'name'],
      },
    });
  }
  if (writable.length > 0) {
    tools.push({
      name: 'propose_actions',
      description: 'Propose entries to add, change, delete or mark; the user confirms first.',
      input_schema: {
        type: 'object',
        properties: {
          ops: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                module: stringEnum(writable.map((m) => m.id)),
                action: { type: 'string' },
                data: { type: 'object' },
                target: { type: 'object', properties: { title: { type: 'string' } } },
              },
              required: ['module', 'action'],
            },
          },
          question: {
            type: 'string',
            description: 'Short German question if something is unclear',
          },
        },
        required: ['ops'],
      },
    });
    return tools;
  }
  if (mode.off) return tools;
  tools.push({
    name: 'create_entry',
    description: 'Propose a new entry; the user confirms it before anything is saved.',
    input_schema: {
      type: 'object',
      properties: {
        module: stringEnum(ids),
        collection: { type: 'string' },
        data: { type: 'object' },
      },
      required: ['module', 'collection', 'data'],
    },
  });
  return tools;
}

/** Stable short hash (FNV-1a) of what the model is told; part of the cache key. */
export function schemaHash(
  manifests: readonly ModuleManifest[],
  mode: WriteMode = { writable: [] },
): string {
  const text = buildSystemPrompt(manifests, mode) + JSON.stringify(buildTools(manifests, mode));
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

export class InvalidModelAnswer extends Error {
  constructor(detail: string) {
    super(`Invalid model answer: ${detail}`);
    this.name = 'InvalidModelAnswer';
  }
}

/** Zod-validates a tool call into an intent. */
export function intentFromToolCall(call: { name: string; input: unknown }): Intent {
  const parse = <T>(
    r: { success: true; data: T } | { success: false; error: { message: string } },
  ): T => {
    if (!r.success) throw new InvalidModelAnswer(`${call.name}: ${r.error.message.slice(0, 200)}`);
    return r.data;
  };
  switch (call.name) {
    case 'run_query':
      return { type: 'query', query: parse(querySchema.safeParse(call.input)) };
    case 'show_agenda':
      return { type: 'agenda', agenda: parse(agendaSchema.safeParse(call.input)) };
    case 'run_computed':
      return { type: 'computed', ...parse(computedSchema.safeParse(call.input)) };
    case 'create_entry':
      return { type: 'create', ...parse(createSchema.safeParse(call.input)) };
    case 'propose_actions':
      return { type: 'write', ...parse(writeSchema.safeParse(call.input)) };
    default:
      throw new InvalidModelAnswer(`unknown tool ${call.name}`);
  }
}
