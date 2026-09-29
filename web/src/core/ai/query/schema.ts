/**
 * The one structured format both assistant stages produce: the local German parser (stage 1)
 * and the LLM tool calls (stage 2) end up as an `Intent`. The executor only ever runs validated
 * intents; nothing the model returns is evaluated as code.
 */
import { z } from 'zod';
import { DATE_RE } from '@/core/time/dates';

export const OPERATORS = [
  'eq',
  'ne',
  'lt',
  'lte',
  'gt',
  'gte',
  'in',
  'contains',
  'between',
] as const;
export type Operator = (typeof OPERATORS)[number];

export const RELATIVE_RANGES = [
  'today',
  'tomorrow',
  'yesterday',
  'this_week',
  'next_week',
  'next_7_days',
  'this_month',
  'next_month',
  'last_month',
  'overdue',
] as const;
export type RelativeRange = (typeof RELATIVE_RANGES)[number];

const scalar = z.union([z.string(), z.number(), z.boolean()]);
const dateStr = z.string().regex(DATE_RE);

export const filterSchema = z.object({
  field: z.string().min(1),
  op: z.enum(OPERATORS),
  value: z.union([scalar, z.array(scalar)]),
});
export type Filter = z.output<typeof filterSchema>;

const rangeFields = {
  from: dateStr.optional(),
  to: dateStr.optional(),
  relative: z.enum(RELATIVE_RANGES).optional(),
};
const hasBound = (r: { from?: string; to?: string; relative?: string }) =>
  r.from !== undefined || r.to !== undefined || r.relative !== undefined;

export const rangeSchema = z
  .object({ field: z.string().min(1).optional(), ...rangeFields })
  .refine(hasBound, { message: 'range needs from, to or relative' });

export const querySchema = z.object({
  module: z.string().min(1),
  collection: z.string().min(1),
  filters: z.array(filterSchema).max(8).default([]),
  range: rangeSchema.optional(),
  sort: z
    .object({ field: z.string().min(1), dir: z.enum(['asc', 'desc']).default('asc') })
    .optional(),
  limit: z.number().int().min(1).max(100).default(20),
  /** `count`, or `sum:<field>` for number/money fields. */
  aggregate: z
    .string()
    .regex(/^(count|sum:[A-Za-z][A-Za-z0-9]*)$/)
    .optional(),
});
export type Query = z.output<typeof querySchema>;

export const agendaSchema = z
  .object({
    /** Restrict to these module ids; absent = every active module. */
    sources: z.array(z.string()).optional(),
    ...rangeFields,
  })
  .refine(hasBound, { message: 'agenda needs from, to or relative' });
export type Agenda = z.output<typeof agendaSchema>;

export const createSchema = z.object({
  module: z.string().min(1),
  collection: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
});

export const computedSchema = z.object({ module: z.string().min(1), name: z.string().min(1) });

/** What an assistant question turns into. `create` always ends in a confirmation dialog. */
export const intentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('query'), query: querySchema }),
  z.object({ type: z.literal('agenda'), agenda: agendaSchema }),
  z.object({ type: z.literal('computed'), ...computedSchema.shape }),
  z.object({ type: z.literal('create'), ...createSchema.shape }),
  z.object({ type: z.literal('fulltext'), text: z.string().min(1).max(200) }),
  /** The model answered in plain words instead of calling a tool. */
  z.object({ type: z.literal('message'), text: z.string().min(1).max(600) }),
]);
export type Intent = z.output<typeof intentSchema>;
export type IntentInput = z.input<typeof intentSchema>;
