import { normalize } from '@/core/text/normalize';
import { tComfort } from '@/strings.comfort';
import { tSettings2 } from '@/strings.settings2';
import { QUICK_SETTINGS, type QuickSetting } from '../quick';
import { groupOf } from './groups';
import { settingsPath } from './paths';
import type { SettingsCategoryDef, SettingsSectionDef } from './types';

export interface SettingsSearchResult {
  category: SettingsSectionDef['category'];
  sectionId: string;
  fieldKey?: string;
  label: string;
  /** "Category › Group › Section" (module settings: "… › Module › Block"); the label names the hit itself. */
  path: string;
  score: number;
  /** A sub-group of a category: the hit opens its first section. */
  group?: string;
  /** The setting is one of the quick switches: the hit can switch it right there (allow-list, `quick.ts`). */
  quick?: QuickSetting['id'];
}

/** Quick switch behind a registry row, found by its link (`/settings/<category>#<section>--<field>`). */
function quickOf(
  category: string,
  sectionId: string,
  fieldKey: string,
): QuickSetting['id'] | undefined {
  const path = settingsPath(category as never, sectionId, fieldKey);
  return QUICK_SETTINGS.find((q) => q.path === path)?.id;
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
  const texts = tSettings2.get();
  const groupNames = texts.groups as Record<string, string>;
  const blockNames = texts.modulePage.blocks as Record<string, string>;
  const out: SettingsSearchResult[] = [];
  const seenGroups = new Set<string>();
  for (const s of sections) {
    const cat = catTitle.get(s.category);
    const catText = normalize(`${cat?.title ?? ''} ${(cat?.keywords ?? []).join(' ')}`);
    const group = groupOf(s);
    const groupName = group ? groupNames[group] : undefined;
    const sectionPath = [cat?.title ?? s.category, groupName, s.title].filter(Boolean).join(' › ');
    // A sub-group is found by its name ("Verwalten", "Netzwerk"): the hit opens its first section.
    if (group && groupName && !seenGroups.has(`${s.category}:${group}`)) {
      seenGroups.add(`${s.category}:${group}`);
      if (matches(normalize(groupName), tokens)) {
        out.push({
          category: s.category,
          sectionId: s.id,
          label: groupName,
          path: cat?.title ?? s.category,
          score: normalize(groupName).startsWith(tokens[0]!) ? 3 : 2,
          group,
        });
      }
    }
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
        // A module's setting names the block of its page: "Modules › Todos › Display".
        path: f.block ? `${sectionPath} › ${blockNames[f.block] ?? f.block}` : sectionPath,
        score: normalize(f.label).includes(tokens[0]!) ? 2 : 0,
        quick: quickOf(s.category, s.id, f.key),
      });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS);
}
