/**
 * Synchronous guess for the bar: is this sentence a search, a question or an entry? Used only to
 * label the first option ("Eintragen …"); the real decision is made by the stages.
 */
import type { ModuleManifest } from '@/core/modules/types';
import { fold } from '../../text';
import { aiModules } from '../../scope';
import { CREATE_VERBS, DELETE_VERBS, POLITE, SEARCH_STARTS, UPDATE_VERBS } from './lexicon';

export type BarIntent = 'write' | 'question' | 'search';

const AMOUNT = /\d[\d.,]*\s?(?:€|eur)/i;
const DATE = /\b\d{1,2}\.\s?\d{1,2}\.?(?:\d{2,4})?\b|\b(?:heute|morgen|übermorgen|gestern)\b/i;

export function detectIntent(text: string, manifests: readonly ModuleManifest[]): BarIntent {
  const words = fold(text)
    .split(/[^a-z0-9-]+/)
    .filter(Boolean);
  while (words.length > 0 && POLITE.includes(words[0]!)) words.shift();
  if (words.length === 0) return 'search';
  const starts = (list: readonly string[]) => words.some((w) => list.some((v) => w.startsWith(v)));
  if (SEARCH_STARTS.some((v) => words[0]!.startsWith(v))) {
    return /^(?:such|find|zeig|anzeig|offne|oeffne)/.test(words[0]!) ? 'search' : 'question';
  }
  if (starts(DELETE_VERBS) || starts(UPDATE_VERBS) || starts(CREATE_VERBS)) return 'write';
  const keywords = aiModules(manifests).flatMap((m) =>
    Object.values(m.aiSchema.actions ?? {}).flatMap((a) => (a.parse?.keywords ?? []).map(fold)),
  );
  const noun = words.some((w) => keywords.some((k) => w.startsWith(k)));
  if (noun && (AMOUNT.test(text) || DATE.test(text) || words.length >= 3)) return 'write';
  return 'search';
}
