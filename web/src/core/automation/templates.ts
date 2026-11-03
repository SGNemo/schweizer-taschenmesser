/**
 * Ready-made rules (all off by default). A template is a rule with a few parameters; the settings
 * hold only "on" and the parameter values. The list itself arrives with the module contracts.
 */
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

export const TEMPLATES: RuleTemplate[] = [];

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
