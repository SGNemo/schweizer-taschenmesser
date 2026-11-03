import { describe, expect, it } from 'vitest';
import { CORE_SECTIONS } from '@/pages/settings/sections';
import { moduleSections } from '@/pages/settings/useSections';
import { availableManifests } from '@/core/modules/available';
import { SETTINGS_CATEGORIES } from './categories';
import { searchSettings } from './search';
import { QUICK_SETTINGS } from '../quick';
import { settingsPath } from './paths';

const find = (q: string) => searchSettings(CORE_SECTIONS, SETTINGS_CATEGORIES, q);

describe('settings search (package 4)', () => {
  it('finds a sub-group by its name and opens its first section', () => {
    const hit = find('verwalten').find((r) => r.group === 'manage');
    expect(hit?.label).toBe('Verwalten');
    expect(hit?.category).toBe('allgemein');
    expect(hit?.sectionId).toBe('profiles');
  });

  it('shows the whole path, including the sub-group', () => {
    const hit = find('änderungsverlauf').find((r) => r.sectionId === 'settings-history');
    expect(hit?.path).toMatch(/ › Verwalten › /);
  });

  it('finds the new sections by everyday words', () => {
    expect(find('abends').some((r) => r.sectionId === 'profiles')).toBe(true);
    expect(find('cache').some((r) => r.sectionId === 'storage')).toBe(true);
    expect(find('rückgängig').some((r) => r.sectionId === 'settings-history')).toBe(true);
    expect(find('glocke').some((r) => r.sectionId === 'notification-sources')).toBe(true);
    expect(find('tastenkürzel').some((r) => r.sectionId === 'shortcuts')).toBe(true);
  });

  it('marks exactly the quick switches as switchable in the hit', () => {
    const switchable = new Set<string>();
    for (const s of CORE_SECTIONS)
      for (const f of s.fields ?? []) {
        const hit = searchSettings([s], SETTINGS_CATEGORIES, f.label).find(
          (r) => r.sectionId === s.id && r.fieldKey === f.key,
        );
        if (hit?.quick) switchable.add(hit.quick);
      }
    // Every quick switch is reachable from a hit (its registry row exists), nothing else is.
    expect([...switchable].sort()).toEqual(QUICK_SETTINGS.map((q) => q.id).sort());
    for (const q of QUICK_SETTINGS) {
      const [category, rest] = q.path.replace('/settings/', '').split('#') as [string, string];
      const [sectionId, fieldKey] = rest.split('--') as [string, string];
      const section = CORE_SECTIONS.find((s) => s.id === sectionId);
      expect(section?.category, q.id).toBe(category);
      expect(settingsPath(section!.category, sectionId, fieldKey), q.id).toBe(q.path);
    }
  });

  it('never offers a switch in the hit for the vault, security or secrets', () => {
    for (const s of CORE_SECTIONS.filter(
      (x) => x.category === 'sicherheit' || x.category === 'sync',
    ))
      for (const f of s.fields ?? [])
        expect(
          searchSettings([s], SETTINGS_CATEGORIES, f.label).every((r) => r.quick === undefined),
          `${s.id}--${f.key}`,
        ).toBe(true);
  });

  it('a module setting shows the block of its page in the path', () => {
    const sections = moduleSections(availableManifests());
    const withFields = sections.find((s) => (s.fields ?? []).some((f) => f.block));
    expect(withFields).toBeDefined();
    const f = withFields!.fields!.find((x) => x.block)!;
    const hit = searchSettings([withFields!], SETTINGS_CATEGORIES, f.label).find(
      (r) => r.fieldKey === f.key,
    );
    expect(hit?.path.split(' › ').length).toBeGreaterThanOrEqual(3);
  });
});
