import { describe, expect, it } from 'vitest';
import { allManifests } from '@/core/modules/registry';
import { visibleSections } from '@/core/settings/registry/registry';
import { SETTINGS_CATEGORY_IDS, type SettingsContext } from '@/core/settings/registry/types';
import { allSettingsSections } from './useSections';

const ctx = (over: Partial<SettingsContext> = {}): SettingsContext => ({
  platform: 'desktop',
  isDev: false,
  isModuleEnabled: () => true,
  ...over,
});

describe('registered settings sections', () => {
  const sections = allSettingsSections(allManifests.filter((m) => !m.retired));

  it('is a valid registry (categories, unique ids)', () => {
    expect(sections.length).toBeGreaterThan(10);
    for (const s of sections) expect(SETTINGS_CATEGORY_IDS).toContain(s.category);
  });

  it('gives every module with settings a section in a valid category', () => {
    for (const m of allManifests.filter((x) => !x.retired && x.settings.fields.length > 0)) {
      const s = sections.find((x) => x.id === `module-${m.id}`);
      expect(s, m.id).toBeDefined();
      expect(s!.category).toBe(m.settings.category ?? 'module');
    }
  });

  it('puts the vault settings under Sicherheit', () => {
    expect(sections.find((s) => s.id === 'module-accounts')?.category).toBe('sicherheit');
  });

  it('shows the developer section only in a dev build', () => {
    const ids = (c: SettingsContext) => visibleSections(sections, c).map((s) => s.id);
    expect(ids(ctx())).not.toContain('developer');
  });

  it('hides the section of a disabled module', () => {
    const visible = visibleSections(sections, ctx({ isModuleEnabled: (id) => id !== 'todos' }));
    expect(visible.map((s) => s.id)).not.toContain('module-todos');
    expect(visible.map((s) => s.id)).toContain('module-calendar');
  });
});
