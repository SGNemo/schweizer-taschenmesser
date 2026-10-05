/**
 * Variant of the local prompt/answer for "the two most likely readings" (measured by
 * `npm run ai:eval -- --top2`; not used by the app yet). The model answers
 * `{"alternatives":[{"ops":[…],"confidence":0.9},{"ops":[…],"confidence":0.4}]}`, best first, the
 * second one optional. Ops are the same as in version 1, so the checks after the model are shared.
 */
import type { ModuleManifest } from '@/core/modules/types';
import type { WriteProposal } from '../write/types';
import { parseAnswer } from './answer';
import { buildGrammar } from './grammar';
import { systemPrompt } from './prompts/v1';

const quoted = (name: string) => `"\\"${name}\\":"`;

/** The v1 grammar with another root: one or two alternatives, each with ops and confidence. */
export function buildTop2Grammar(writable: readonly ModuleManifest[]): string {
  const lines = buildGrammar(writable)
    .split('\n')
    .filter((l) => !l.startsWith('root ::='));
  return [
    `root ::= "{" ${quoted('alternatives')} "[" alt ("," alt)? "]}"`,
    `alt ::= "{" ${quoted('ops')} "[" (op ("," op){0,7})? "]," ${quoted('confidence')} conf "}"`,
    ...lines,
  ].join('\n');
}

/** The v1 system prompt, with the answer format and the examples changed to alternatives. */
export function top2SystemPrompt(writable: readonly ModuleManifest[]): string {
  return systemPrompt(writable)
    .split('\n')
    .map((line) => {
      if (line.startsWith('- "confidence"'))
        return '- "alternatives": the two most likely readings of the sentence, best first (give only one when it is clearly unambiguous). Each has "ops" and "confidence" (0 to 1, how sure you are).';
      if (line.startsWith('- If the sentence is not a request'))
        return '- If the sentence is not a request to add, change, delete or mark entries, answer {"alternatives":[{"ops":[],"confidence":0}]}.';
      return line.replace(
        /^(Ausgabe: )\{"ops":(.*),"confidence":([\d.]+),"question":""\}$/,
        '$1{"alternatives":[{"ops":$2,"confidence":$3}]}',
      );
    })
    .join('\n');
}

/** Valid alternatives in the order the model gave them (empty readings are dropped). */
export function parseTop2(text: string): WriteProposal[] {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return [];
  }
  const list = (json as { alternatives?: unknown })?.alternatives;
  if (!Array.isArray(list)) return [];
  return list
    .slice(0, 2)
    .map((alt) => parseAnswer(JSON.stringify({ ...(alt as object), question: '' })))
    .filter((p): p is WriteProposal => p !== undefined);
}
