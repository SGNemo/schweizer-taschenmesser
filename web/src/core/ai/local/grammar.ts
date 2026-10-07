/**
 * GBNF grammar for the answer of the local model: the model can only produce
 * `{"ops":[{module, action, [target], [data]}…],"confidence":0.9,"question":""}` with the modules,
 * actions and fields that exist and values of the right type. Every repetition is bounded, so an
 * answer always ends (a model that never "chooses" to stop would otherwise run to the token limit).
 * Whether the content makes sense is checked afterwards like for every stage (`prepareProposal`).
 */
import type { AiFieldType, ModuleManifest } from '@/core/modules/types';

const str = (s: string): string => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
/** A JSON key with its colon, as a grammar literal: `"\"title\":"`. */
const key = (name: string): string => str(`"${name}":`);

const RECURRENCE = [
  `"{" ${key('freq')} ("\\"daily\\"" | "\\"weekly\\"" | "\\"monthly\\"" | "\\"yearly\\"")`,
  `("," ${key('interval')} [0-9]{1,2})?`,
  `("," ${key('byWeekday')} "[" [1-7] ("," [1-7]){0,6} "]")?`,
  `("," ${key('byMonthDay')} "-"? [0-9]{1,2})?`,
  `"}"`,
].join(' ');

/** Value rule of a field type (rule names are shared, see `COMMON`). */
function valueRule(type: AiFieldType): string {
  if (type.startsWith('enum:')) {
    const values = type.slice(5).split('|');
    return `"\\"" (${values.map(str).join(' | ')}) "\\""`;
  }
  switch (type) {
    case 'money':
    case 'num':
    case 'ts':
      return 'int';
    case 'date':
      return 'date';
    case 'bool':
      return 'bool';
    case 'recurrence':
      return 'recurrence';
    case 'tags':
      return 'tags';
    default:
      return 'string';
  }
}

const COMMON = `
string ::= "\\"" [^"\\\\\\n]{0,80} "\\""
qstring ::= "\\"" [^"\\\\\\n]{0,120} "\\""
int ::= "-"? [0-9]{1,9}
date ::= "\\"" [0-9]{4} "-" [0-9]{2} "-" [0-9]{2} "\\""
bool ::= "true" | "false"
tags ::= "[" (string ("," string){0,5})? "]"
recurrence ::= ${RECURRENCE}
conf ::= "0" | "1" | "0." [0-9]{1,2}`;

const ruleName = (module: string, action: string): string => `${module}-${action.toLowerCase()}`;

export function buildGrammar(writable: readonly ModuleManifest[]): string {
  const ops: string[] = [];
  const rules: string[] = [];
  for (const m of writable) {
    const schema = m.aiSchema!;
    for (const [id, a] of Object.entries(schema.actions ?? {})) {
      const name = ruleName(m.id, id);
      ops.push(name);
      const head = `"{" ${key('module')} ${str(`"${m.id}"`)} "," ${key('action')} ${str(`"${id}"`)}`;
      const target = a.kind === 'create' ? '' : ` "," ${key('target')} string`;
      if (a.kind === 'delete' || a.kind === 'transition') {
        rules.push(`${name} ::= ${head}${target} "}"`);
        continue;
      }
      const fields = (a.fields ?? []).filter((f) => f in schema.collections[a.collection]!.fields);
      const pairs = fields
        .map((f) => `${key(f)} ${valueRule(schema.collections[a.collection]!.fields[f]!)}`)
        .join(' | ');
      rules.push(`${name} ::= ${head}${target} "," ${key('data')} ${name}-data "}"`);
      rules.push(
        `${name}-data ::= "{" (${name}-f ("," ${name}-f){0,${Math.max(0, fields.length - 1)}})? "}"`,
      );
      rules.push(`${name}-f ::= ${pairs}`);
    }
  }
  const op = ops.length > 0 ? ops.join(' | ') : '"{}"';
  return [
    `root ::= "{" ${key('ops')} "[" (op ("," op){0,7})? "]," ${key('confidence')} conf "," ${key('question')} qstring "}"`,
    `op ::= ${op}`,
    ...rules,
    COMMON.trim(),
  ].join('\n');
}
