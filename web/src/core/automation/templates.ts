/**
 * Ready-made rules (all off by default). A template is a rule with a few parameters; the settings
 * hold only "on" and the parameter values. The list itself arrives with the module contracts.
 */
import { tAuto } from '@/strings.automation';
import type { Rule } from './types';
import type { AutomationSettings } from './settings';

export type ParamValue = string | number | boolean;

export interface TemplateParam {
  key: string;
  type: 'number' | 'text' | 'time' | 'boolean';
  default: ParamValue;
  min?: number;
  max?: number;
}

export interface RuleTemplate {
  id: string;
  /** Texts via getters (read at render time). */
  readonly title: string;
  readonly description: string;
  /** The modules the rule reads from or writes to; the template is offered when they are enabled. */
  modules: readonly string[];
  params: readonly TemplateParam[];
  build(params: Record<string, ParamValue>): Rule;
}

const x = () => tAuto.get().templates;
const num = (v: ParamValue, fallback: number): number => (typeof v === 'number' ? v : fallback);
const text = (v: ParamValue, fallback: string): string => (typeof v === 'string' ? v : fallback);

/** Shorthand: a template whose texts come from `strings.automation.ts`. */
function template(
  id: keyof ReturnType<typeof x>,
  modules: readonly string[],
  params: readonly TemplateParam[],
  build: (
    p: Record<string, ParamValue>,
    texts: ReturnType<typeof x>[typeof id],
  ) => Omit<Rule, 'id' | 'title'>,
): RuleTemplate {
  return {
    id,
    get title() {
      return x()[id].title;
    },
    get description() {
      return x()[id].description;
    },
    modules,
    params,
    build: (p) => ({ id: `tpl-${id}`, title: x()[id].title, ...build(p, x()[id]) }),
  };
}

const DAYS = (def: number): TemplateParam => ({
  key: 'daysBefore',
  type: 'number',
  default: def,
  min: 1,
  max: 30,
});
const TIME = (def: string): TemplateParam => ({ key: 'time', type: 'time', default: def });

/** All off by default; each needs the modules it reads from and writes to. */
export const TEMPLATES: RuleTemplate[] = [
  template('invoiceDue', ['invoices', 'todos'], [DAYS(3)], (p, tx) => ({
    trigger: { kind: 'event', type: 'invoice.dueSoon' },
    conditions: [{ field: 'daysLeft', op: 'lte', value: num(p.daysBefore!, 3) }],
    actions: [
      { kind: 'reminder', title: (tx as { reminder: string }).reminder },
      {
        kind: 'entry',
        module: 'todos',
        action: 'create',
        data: { title: (tx as { task: string }).task, dueDate: '{dueDate}' },
      },
    ],
    limitPerHour: 5,
  })),
  template('stockLow', ['pantry', 'lists'], [], () => ({
    trigger: { kind: 'event', type: 'pantry.belowMinimum' },
    conditions: [],
    actions: [{ kind: 'entry', module: 'lists', action: 'create', data: { name: '{name}' } }],
    limitPerHour: 5,
  })),
  template('priceUp', ['subscriptions'], [], (_p, tx) => ({
    trigger: { kind: 'event', type: 'subscription.priceChanged' },
    conditions: [{ field: 'percent', op: 'gt', value: 0 }],
    actions: [{ kind: 'notice', title: (tx as { notice: string }).notice }],
    limitPerHour: 3,
  })),
  template('weeklyReview', [], [TIME('18:00')], (p, tx) => ({
    trigger: { kind: 'schedule', time: text(p.time!, '18:00'), weekdays: [0] },
    conditions: [],
    actions: [
      {
        kind: 'notice',
        title: (tx as { notice: string }).notice,
        body: (tx as { body: string }).body,
      },
    ],
    limitPerHour: 1,
  })),
  template('invoiceMail', ['mail', 'invoices'], [], () => ({
    trigger: { kind: 'event', type: 'mail.invoiceReceived' },
    conditions: [],
    actions: [
      {
        kind: 'suggest',
        module: 'invoices',
        action: 'create',
        data: { payee: '{payee}', amountMinor: '{amountMinor}', dueDate: '{dueDate}' },
      },
    ],
    limitPerHour: 5,
  })),
  template(
    'timeFocus',
    ['timetrack'],
    [{ key: 'minutes', type: 'number', default: 25, min: 5, max: 120 }],
    (p, tx) => ({
      trigger: { kind: 'event', type: 'timetrack.started' },
      conditions: [],
      actions: [
        { kind: 'focus', title: (tx as { task: string }).task, minutes: num(p.minutes!, 25) },
      ],
      limitPerHour: 3,
    }),
  ),
  template('renewal', ['subscriptions'], [DAYS(3)], (p, tx) => ({
    trigger: { kind: 'event', type: 'subscription.renewsSoon' },
    conditions: [{ field: 'daysLeft', op: 'lte', value: num(p.daysBefore!, 3) }],
    actions: [{ kind: 'reminder', title: (tx as { reminder: string }).reminder }],
    limitPerHour: 5,
  })),
  template('habitEvening', ['habits'], [TIME('19:00')], (p, tx) => ({
    trigger: { kind: 'event', type: 'habits.goal.open' },
    conditions: [{ window: { from: text(p.time!, '19:00'), to: '23:00' } }],
    actions: [
      {
        kind: 'notice',
        title: (tx as { notice: string }).notice,
        body: (tx as { body: string }).body,
      },
    ],
    limitPerHour: 3,
  })),
  template('pantryExpiry', ['pantry', 'todos'], [DAYS(3)], (p, tx) => ({
    trigger: { kind: 'event', type: 'pantry.expiringSoon' },
    conditions: [{ field: 'daysLeft', op: 'lte', value: num(p.daysBefore!, 3) }],
    actions: [
      {
        kind: 'entry',
        module: 'todos',
        action: 'create',
        data: { title: (tx as { task: string }).task, dueDate: '{expires}' },
      },
    ],
    limitPerHour: 5,
  })),
  template('workMorning', [], [TIME('08:00')], (p) => ({
    trigger: { kind: 'schedule', time: text(p.time!, '08:00'), weekdays: [1, 2, 3, 4, 5] },
    conditions: [],
    actions: [{ kind: 'profile', profileId: 'work' }],
    limitPerHour: 1,
  })),
  template('eveningProfile', [], [TIME('21:00')], (p) => ({
    trigger: { kind: 'schedule', time: text(p.time!, '21:00') },
    conditions: [],
    actions: [{ kind: 'profile', profileId: 'evening' }],
    limitPerHour: 1,
  })),
  template('taskDone', ['todos'], [], (_p, tx) => ({
    trigger: { kind: 'event', type: 'todos.task.completed' },
    conditions: [{ field: 'priority', op: 'gte', value: 3 }],
    actions: [{ kind: 'notice', title: (tx as { notice: string }).notice }],
    limitPerHour: 3,
  })),
];

/** The parameters of a template with the stored values over the defaults. */
export function paramsOf(
  template: RuleTemplate,
  stored: Record<string, ParamValue> | undefined,
): Record<string, ParamValue> {
  return Object.fromEntries(template.params.map((p) => [p.key, stored?.[p.key] ?? p.default]));
}

/** The rules the user switched on. */
export function resolveRules(
  settings: Pick<AutomationSettings, 'enabled' | 'rules'>,
  templates: readonly RuleTemplate[] = TEMPLATES,
): Rule[] {
  if (!settings.enabled) return [];
  return templates.flatMap((tpl) => {
    const cfg = settings.rules[tpl.id];
    return cfg?.enabled ? [tpl.build(paramsOf(tpl, cfg.params))] : [];
  });
}
