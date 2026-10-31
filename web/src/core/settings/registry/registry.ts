import { compareText } from '@/core/i18n/format';
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
    if (s.maturity !== 'stable' && s.maturity !== 'preview')
      errors.push(`section "${s.id}" needs maturity 'stable' or 'preview'`);
  }
  return errors;
}

const bySort = (a: SettingsSectionDef, b: SettingsSectionDef) =>
  a.order - b.order || compareText(a.title, b.title);

/**
 * The maturity rule for sections: a `preview` section shows while "In Arbeit anzeigen" is on or
 * what it controls is in use (`previewInUse`), so nothing the user switched on becomes unreachable.
 */
export const isMaturityVisible = (s: SettingsSectionDef, ctx: SettingsContext): boolean =>
  s.maturity !== 'preview' || ctx.showPreview || s.previewInUse?.(ctx) === true;

/** Visible sections in navigation order (category order, then `order`, then title). */
export function visibleSections(
  sections: readonly SettingsSectionDef[],
  ctx: SettingsContext,
): SettingsSectionDef[] {
  const catRank = (c: SettingsCategoryId) => SETTINGS_CATEGORY_IDS.indexOf(c);
  return sections
    .filter((s) => (!s.visibleWhen || s.visibleWhen(ctx)) && isMaturityVisible(s, ctx))
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
