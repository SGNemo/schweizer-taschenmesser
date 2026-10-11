import { describe, expect, it } from 'vitest';
import { CORE_SECTIONS } from '@/pages/settings/sections';
import { tComfort } from '@/strings.comfort';
import { SETTINGS_CATEGORIES } from './categories';
import { searchSettings } from './search';

const find = (q: string) => searchSettings(CORE_SECTIONS, SETTINGS_CATEGORIES, q);

describe('settings search synonyms', () => {
  it('finds settings by everyday words, not only by their labels', () => {
    expect(find('dunkel').some((r) => r.sectionId === 'appearance' && r.fieldKey === 'theme')).toBe(
      true,
    );
    expect(find('stumm').some((r) => r.sectionId === 'calm-reminders')).toBe(true);
    expect(find('sicherung').some((r) => r.sectionId === 'backup')).toBe(true);
    expect(find('schrift größer').some((r) => r.fieldKey === 'textSize')).toBe(true);
    expect(find('nicht stören').some((r) => r.sectionId === 'calm-reminders')).toBe(true);
  });

  it('every synonym key points to a real section or setting (no stale entries)', () => {
    const ids = new Set<string>();
    for (const s of CORE_SECTIONS) {
      ids.add(s.id);
      for (const f of s.fields ?? []) ids.add(`${s.id}--${f.key}`);
    }
    for (const key of Object.keys(tComfort.de.synonyms)) expect(ids.has(key), key).toBe(true);
  });

  it('has the same keys in every language', () => {
    const keys = Object.keys(tComfort.de.synonyms).sort();
    for (const lang of ['en', 'es', 'fr', 'pt-BR'] as const)
      expect(Object.keys(tComfort[lang].synonyms).sort(), lang).toEqual(keys);
  });
});
