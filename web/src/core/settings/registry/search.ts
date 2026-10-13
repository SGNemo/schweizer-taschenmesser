import { normalize } from '@/core/text/normalize';
import { tComfort } from '@/strings.comfort';
import type { SettingsCategoryDef, SettingsSectionDef } from './types';

export interface SettingsSearchResult {
  category: SettingsSectionDef['category'];
  sectionId: string;
  fieldKey?: string;
  label: string;
  /** "Category › Section" (and the setting for field hits). */
  path: string;
  score: number;
}

const MAX_RESULTS = 12;

function matches(haystack: string, tokens: string[]): boolean {
  return tokens.every((tok) => haystack.includes(tok));
}

/**
 * Extra words people type for a section (`<section>`) or one setting (`<section>--<field>`), in the
 * current language. Kept apart from the section's own `keywords` so they can grow without touching
 * every section.
 */
export type ExtraWords = (id: string) => readonly string[];
const comfortWords: ExtraWords = (id) => tComfort.get().synonyms[id] ?? [];

/**
 * Searches title, description, keywords and the settings (fields) of the given visible sections.
 * Every word of the query must occur (order does not matter); diacritics and case are ignored.
 */
export function searchSettings(
  sections: readonly SettingsSectionDef[],
  categories: readonly SettingsCategoryDef[],
  query: string,
  extra: ExtraWords = comfortWords,
): SettingsSearchResult[] {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const catTitle = new Map(categories.map((c) => [c.id, c]));
  const out: SettingsSearchResult[] = [];
  for (const s of sections) {
    const cat = catTitle.get(s.category);
    const catText = normalize(`${cat?.title ?? ''} ${(cat?.keywords ?? []).join(' ')}`);
    const sectionPath = `${cat?.title ?? s.category} › ${s.title}`;
    const own = normalize(
      [s.title, s.description ?? '', ...(s.keywords ?? []), ...extra(s.id)].join(' '),
    );
    if (matches(`${own} ${catText}`, tokens)) {
      const title = normalize(s.title);
      out.push({
        category: s.category,
        sectionId: s.id,
        label: s.title,
        path: sectionPath,
        score: title.startsWith(tokens[0]!) ? 3 : title.includes(tokens[0]!) ? 2 : 1,
      });
    }
    for (const f of s.fields ?? []) {
      const text = normalize(
        `${f.label} ${f.description ?? ''} ${s.title} ${extra(`${s.id}--${f.key}`).join(' ')}`,
      );
      if (!matches(`${text} ${catText}`, tokens)) continue;
      out.push({
        category: s.category,
        sectionId: s.id,
        fieldKey: f.key,
        label: f.label,
        path: sectionPath,
        score: normalize(f.label).includes(tokens[0]!) ? 2 : 0,
      });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS);
}
