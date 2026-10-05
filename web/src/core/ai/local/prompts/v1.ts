/**
 * Prompt of the built-in local model, version 1. Versioned on purpose: the evaluation
 * (`npm run ai:eval`) measures exactly this text, and a change here means a new version and a new
 * measurement. The system part is the stable prefix of every request (schema, actions, examples), so
 * the KV cache keeps it; the date and the sentence come last.
 *
 * Unlike the cloud prompt it may be richer – nothing leaves the device – but it still carries no
 * entries: targets are matched locally by the words the user used, exactly as in the other stages.
 */
import type { ModuleManifest } from '@/core/modules/types';
import { formatDay } from '@/core/time/dates';
import { buildActionText, buildSchemaText } from '../../prompt';
import { TEMPLATES, type TemplateId } from '../catalogue';

export const PROMPT_VERSION = 1;

/** The examples show this day; the user message of a real request carries the real one. */
export const EXAMPLE_TODAY = '2026-09-29';

const MAX_EXAMPLES = 6;

interface Example {
  input: string;
  output: string;
}

/** A few examples across modules and action kinds, taken from the manifests' own `examples`. */
export function pickExamples(writable: readonly ModuleManifest[]): Example[] {
  const all = writable.flatMap((m) =>
    Object.entries(m.aiSchema!.actions ?? {}).flatMap(([id, a]) =>
      a.examples.slice(0, 1).map((e) => ({ m, id, a, e })),
    ),
  );
  const chosen: typeof all = [];
  const seenModules = new Set<string>();
  // One create per module first (up to four modules) …
  for (const x of all) {
    if (x.a.kind === 'create' && !seenModules.has(x.m.id) && seenModules.size < 4) {
      seenModules.add(x.m.id);
      chosen.push(x);
    }
  }
  // … then one example of every other kind.
  for (const kind of ['update', 'delete', 'transition'] as const) {
    const hit = all.find((x) => x.a.kind === kind && !chosen.includes(x));
    if (hit) chosen.push(hit);
  }
  return chosen.slice(0, MAX_EXAMPLES).map(({ m, id, a, e }) => {
    const op: Record<string, unknown> = { module: m.id, action: id };
    if (a.kind !== 'create') op.target = e.target;
    if (a.kind === 'create' || a.kind === 'update') op.data = e.output;
    return {
      input: userMessage(e.input, EXAMPLE_TODAY),
      output: JSON.stringify({ ops: [op], confidence: 0.95, question: '' }),
    };
  });
}

export const userMessage = (text: string, today: string): string =>
  `Heute: ${today} (${formatDay(today, 'EEEE')})\nEingabe: ${text.trim()}`;

/** Role, rules, schema, actions, examples. Identical for every request while the modules stay the same. */
export function systemPrompt(writable: readonly ModuleManifest[]): string {
  const examples = pickExamples(writable)
    .map((e) => `${e.input}\nAusgabe: ${e.output}`)
    .join('\n\n');
  return [
    'You turn one German sentence into JSON for a personal organiser app. Answer with the JSON only.',
    'Modules and fields (field:type, "!" = required, money in integer cents, dates YYYY-MM-DD, times HH:mm):',
    buildSchemaText(writable),
    'Actions of each module (! = required field):',
    buildActionText(writable, false),
    'Rules:',
    '- "ops": one op per entry the sentence talks about; "module" and "action" must be listed above; "data" only has the fields of that action, leave out what is unknown.',
    '- update, delete and "sets" actions need "target": the words the user used for the existing entry.',
    '- "confidence": 0 to 1, how sure you are. "question": one short German question when something important is missing, otherwise "".',
    '- If the sentence is not a request to add, change, delete or mark entries, answer {"ops":[],"confidence":0,"question":""}.',
    'Examples:',
    examples,
  ].join('\n');
}

/** Puts system and user text into the model's chat format (the answer starts right after it). */
export function formatChat(template: TemplateId, system: string, user: string): string {
  return TEMPLATES[template].replace('{system}', () => system).replace('{user}', () => user);
}
