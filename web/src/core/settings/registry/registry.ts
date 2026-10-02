import {
  isCategoryId,
  SETTINGS_CATEGORY_IDS,
  type SettingsCategoryId,
  type SettingsContext,
  type SettingsSectionDef,
} from './types';

/** Problems that make a section list invalid: unknown/missing category, duplicate ids, missing text. */
export function validateSections(sections: readonly SettingsSectionDef[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const s of sections) {
    if (!s.id) errors.push('section without id');
    if (seen.has(s.id)) errors.push(`duplicate section id "${s.id}"`);
    seen.add(s.id);
    if (!isCategoryId(s.category as string | undefined))
      errors.push(`section "${s.id}" has no valid category`);
    if (!s.title) errors.push(`section "${s.id}" has no title`);
  }
  return errors;
}

const bySort = (a: SettingsSectionDef, b: SettingsSectionDef) =>
  a.order - b.order || a.title.localeCompare(b.title, 'de');

/** Visible sections in navigation order (category order, then `order`, then title). */
export function visibleSections(
  sections: readonly SettingsSectionDef[],
  ctx: SettingsContext,
): SettingsSectionDef[] {
  const catRank = (c: SettingsCategoryId) => SETTINGS_CATEGORY_IDS.indexOf(c);
  return sections
    .filter((s) => !s.visibleWhen || s.visibleWhen(ctx))
    .sort((a, b) => catRank(a.category) - catRank(b.category) || bySort(a, b));
}

export function sectionsOf(
  visible: readonly SettingsSectionDef[],
  category: SettingsCategoryId,
): SettingsSectionDef[] {
  return visible.filter((s) => s.category === category);
}

/** Categories that have at least one visible section, in navigation order. */
export function visibleCategoryIds(visible: readonly SettingsSectionDef[]): SettingsCategoryId[] {
  return SETTINGS_CATEGORY_IDS.filter((c) => visible.some((s) => s.category === c));
}
