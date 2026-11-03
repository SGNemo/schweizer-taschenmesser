/**
 * Automations ("Wenn X, dann Y"): the rule model. A rule is a trigger, conditions and actions. There
 * is deliberately no action that deletes, sends or pays: the union below is the whole list.
 */
import { z } from 'zod';
import { TIME_RE } from '@/core/time/dates';

/** The vault is neither a trigger nor a target (also enforced by `eligibility.ts`). */
export const EXCLUDED_MODULES: readonly string[] = ['accounts'];

/** An occurrence the engine reacts to. `data` holds flat fields that conditions and templates read. */
export interface AutomationEvent {
  /** `<module>.<collection>.created|updated|deleted|restored`, a domain event like `invoice.dueSoon`, or `schedule.fire`. */
  type: string;
  moduleId?: string;
  /** Stable per occurrence: the same rule fires at most once for the same key. */
  key: string;
  at: number;
  data: Record<string, unknown>;
  /** Short text for the log (never more than a title). */
  title?: string;
  /** Set when the event was caused by a rule run: the basis of the loop guard. */
  cause?: RunCause;
}

export interface RunCause {
  runId: string;
  ruleIds: string[];
  depth: number;
}

export const OPS = ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'contains', 'in'] as const;
export type Op = (typeof OPS)[number];

const scalar = z.union([z.string(), z.number(), z.boolean()]);

export const conditionSchema = z.union([
  z.object({
    field: z.string().min(1).max(60),
    op: z.enum(OPS),
    value: z.union([scalar, z.array(scalar).max(30)]),
  }),
  z.object({
    window: z.object({
      from: z.string().regex(TIME_RE),
      to: z.string().regex(TIME_RE),
      /** 0 = Sunday … 6 = Saturday. */
      weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    }),
  }),
]);
export type Condition = z.infer<typeof conditionSchema>;

/** Text or number; `{field}` in a string is replaced by the event's field (a lone `{field}` keeps its type). */
const template = z.union([z.string().max(300), z.number(), z.boolean()]);
const templates = z.record(z.string(), template);

export const actionSchema = z.discriminatedUnion('kind', [
  /** Create or change an entry through an `aiSchema.actions` contract of a module. */
  z.object({
    kind: z.literal('entry'),
    module: z.string().min(1).max(40),
    action: z.string().min(1).max(60),
    data: templates.optional(),
    target: z
      .object({ id: z.string().max(100).optional(), title: z.string().max(300).optional() })
      .optional(),
  }),
  /** A reminder at a later time (notification centre, calm policy applies). */
  z.object({
    kind: z.literal('reminder'),
    title: z.string().min(1).max(200),
    body: z.string().max(300).optional(),
    inMinutes: z
      .number()
      .int()
      .min(0)
      .max(60 * 24 * 30)
      .optional(),
    url: z.string().max(200).optional(),
  }),
  /** A hint in the notification centre, now. */
  z.object({
    kind: z.literal('notice'),
    title: z.string().min(1).max(200),
    body: z.string().max(300).optional(),
    url: z.string().max(200).optional(),
  }),
  /** Starts a focus round, unless one is running. */
  z.object({
    kind: z.literal('focus'),
    title: z.string().min(1).max(200),
    minutes: z.number().int().min(5).max(120),
  }),
  /** Switches to a profile (built-in `quiet`, `work`, `evening` or a custom id). */
  z.object({ kind: z.literal('profile'), profileId: z.string().min(1).max(40) }),
  /** Leaves an entry for the user to confirm (pending batch), nothing is written yet. */
  z.object({
    kind: z.literal('suggest'),
    module: z.string().min(1).max(40),
    action: z.string().min(1).max(60),
    data: templates,
  }),
]);
export type Action = z.infer<typeof actionSchema>;
export type ActionKind = Action['kind'];
export const ACTION_KINDS: readonly ActionKind[] = [
  'entry',
  'reminder',
  'notice',
  'focus',
  'profile',
  'suggest',
];

export const triggerSchema = z.union([
  z.object({ kind: z.literal('event'), type: z.string().min(1).max(80) }),
  z.object({
    kind: z.literal('schedule'),
    time: z.string().regex(TIME_RE),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  }),
]);
export type Trigger = z.infer<typeof triggerSchema>;

export const ruleSchema = z.object({
  id: z.string().min(1).max(60),
  /** Name in the log and the palette. */
  title: z.string().min(1).max(120),
  trigger: triggerSchema,
  conditions: z.array(conditionSchema).max(10),
  actions: z.array(actionSchema).min(1).max(5),
  /** Runs per hour, at most. */
  limitPerHour: z.number().int().min(1).max(60),
});
export type Rule = z.infer<typeof ruleSchema>;

export const DEFAULT_LIMIT_PER_HOUR = 3;
/** Rules that cause rules that cause rules …: deeper chains are not run. */
export const MAX_DEPTH = 3;
