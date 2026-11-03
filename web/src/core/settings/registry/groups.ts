/**
 * Second navigation level: sub-groups inside a category. A section names its group itself
 * (`group` on `SettingsSectionDef`); the core sections are placed here in one table so the
 * structure can be read and changed in one place. Sections without a group stand alone.
 */
import type { SettingsCategoryId, SettingsSectionDef } from './types';

/** Group ids per category, in display order (texts: `tSettings2.groups`). */
export const CATEGORY_GROUPS: Partial<Record<SettingsCategoryId, readonly string[]>> = {
  allgemein: ['profile', 'input', 'data'],
  darstellung: ['look', 'reading', 'more'],
  ki: ['switch', 'providers', 'usage'],
  verbindungen: ['services', 'network'],
  ueber: ['app', 'legal', 'support'],
};

/** Core section id → group id. */
const SECTION_GROUP: Readonly<Record<string, string>> = {
  general: 'profile',
  shortcuts: 'input',
  'recently-deleted': 'data',
  appearance: 'look',
  favourites: 'look',
  reading: 'reading',
  focus: 'reading',
  advanced: 'more',
  'ai-switch': 'switch',
  ai: 'providers',
  'ai-write': 'providers',
  'ai-local': 'providers',
  'ai-stats': 'usage',
  connectors: 'services',
  weather: 'services',
  share: 'services',
  'browser-extension': 'services',
  network: 'network',
  localapi: 'network',
  about: 'app',
  'about-updates': 'app',
  setup: 'app',
  supporter: 'app',
  links: 'legal',
  'legal-imprint': 'legal',
  'legal-privacy': 'legal',
  licenses: 'legal',
  'model-licenses': 'legal',
  diagnostics: 'support',
  'device-reset': 'support',
};

/** Group of a section within its category, or undefined for a section that stands alone. */
export function groupOf(
  s: Pick<SettingsSectionDef, 'id' | 'category' | 'group'>,
): string | undefined {
  const g = s.group ?? SECTION_GROUP[s.id];
  return g && CATEGORY_GROUPS[s.category]?.includes(g) ? g : undefined;
}

export interface SectionGroup<S> {
  /** `undefined` = sections without a group (listed first, without a heading). */
  group: string | undefined;
  sections: S[];
}

/** The category's sections split into its groups (declared order); ungrouped ones come first. */
export function groupSections<S extends Pick<SettingsSectionDef, 'id' | 'category' | 'group'>>(
  category: SettingsCategoryId,
  sections: readonly S[],
): SectionGroup<S>[] {
  const out: SectionGroup<S>[] = [];
  const loose = sections.filter((s) => !groupOf(s));
  if (loose.length > 0) out.push({ group: undefined, sections: loose });
  for (const g of CATEGORY_GROUPS[category] ?? []) {
    const own = sections.filter((s) => groupOf(s) === g);
    if (own.length > 0) out.push({ group: g, sections: own });
  }
  return out;
}
