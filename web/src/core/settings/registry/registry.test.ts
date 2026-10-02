import { describe, expect, it } from 'vitest';
import { SETTINGS_CATEGORIES } from './categories';
import { legacyTarget, settingsPath } from './paths';
import { sectionsOf, validateSections, visibleCategoryIds, visibleSections } from './registry';
import { searchSettings } from './search';
import { SETTINGS_CATEGORY_IDS, type SettingsContext, type SettingsSectionDef } from './types';

const ctx = (over: Partial<SettingsContext> = {}): SettingsContext => ({
  platform: 'web',
  isDev: false,
  isModuleEnabled: () => true,
  ...over,
});
const sec = (over: Partial<SettingsSectionDef> & { id: string }): SettingsSectionDef => ({
  category: 'allgemein',
  order: 10,
  title: over.id,
  render: () => null,
  ...over,
});

describe('settings registry', () => {
  it('has a definition with text for every category', () => {
    expect(SETTINGS_CATEGORIES.map((c) => c.id)).toEqual([...SETTINGS_CATEGORY_IDS]);
    for (const c of SETTINGS_CATEGORIES) {
      expect(c.title).not.toBe('');
      expect(c.description).not.toBe('');
    }
  });

  it('sorts by category order, then order, then title', () => {
    const all = [
      sec({ id: 'b', category: 'ki', order: 10 }),
      sec({ id: 'z', category: 'allgemein', order: 20, title: 'Zeta' }),
      sec({ id: 'a', category: 'allgemein', order: 20, title: 'Alpha' }),
      sec({ id: 'first', category: 'allgemein', order: 1 }),
    ];
    expect(visibleSections(all, ctx()).map((s) => s.id)).toEqual(['first', 'a', 'z', 'b']);
  });

  it('hides sections by visibleWhen (dev build, platform, module state)', () => {
    const all = [
      sec({ id: 'dev', category: 'entwickler', visibleWhen: (c) => c.isDev }),
      sec({ id: 'desk', visibleWhen: (c) => c.platform === 'desktop' }),
      sec({ id: 'mod', visibleWhen: (c) => c.isModuleEnabled('todos') }),
    ];
    expect(visibleSections(all, ctx()).map((s) => s.id)).toEqual(['mod']);
    expect(visibleSections(all, ctx({ isDev: true })).map((s) => s.id)).toContain('dev');
    expect(visibleSections(all, ctx({ platform: 'desktop' })).map((s) => s.id)).toContain('desk');
    expect(
      visibleSections(all, ctx({ isModuleEnabled: () => false })).map((s) => s.id),
    ).not.toContain('mod');
  });

  it('only lists categories that have a visible section', () => {
    const visible = visibleSections([sec({ id: 'a', category: 'ki' })], ctx());
    expect(visibleCategoryIds(visible)).toEqual(['ki']);
    expect(sectionsOf(visible, 'ki')).toHaveLength(1);
    expect(sectionsOf(visible, 'sync')).toHaveLength(0);
  });

  it('rejects a missing category, duplicate ids and a missing title', () => {
    expect(validateSections([sec({ id: 'a' })])).toEqual([]);
    expect(validateSections([sec({ id: 'a' }), sec({ id: 'a' })])).toHaveLength(1);
    expect(validateSections([sec({ id: 'a', category: undefined as never })]).join()).toContain(
      'no valid category',
    );
    expect(validateSections([sec({ id: 'a', category: 'nope' as never })])).toHaveLength(1);
    expect(validateSections([sec({ id: 'a', title: '' })])).toHaveLength(1);
  });
});

describe('settings search', () => {
  const sections = [
    sec({
      id: 'quickcapture',
      category: 'schnellerfassung',
      title: 'Schnellerfassung',
      keywords: ['Hotkey'],
      fields: [{ key: 'hotkey', label: 'Tastenkürzel', description: 'Öffnet das Eingabefenster' }],
    }),
    sec({ id: 'ai', category: 'ki', title: 'KI-Assistent', description: 'Anbieter und Limits' }),
  ];

  it('finds by title, keyword, field label and description, ignoring case and diacritics', () => {
    const find = (q: string) => searchSettings(sections, SETTINGS_CATEGORIES, q);
    expect(find('hotkey')[0]?.sectionId).toBe('quickcapture');
    expect(find('TASTENKURZEL')[0]?.fieldKey).toBe('hotkey');
    expect(find('eingabefenster').some((r) => r.fieldKey === 'hotkey')).toBe(true);
    expect(find('anbieter')[0]?.sectionId).toBe('ai');
    expect(find('anbieter limits')).toHaveLength(1);
    expect(find('')).toEqual([]);
    expect(find('gibtesnicht')).toEqual([]);
  });

  it('shows the category path and also matches the category name', () => {
    const r = searchSettings(sections, SETTINGS_CATEGORIES, 'tastenkürzel')[0]!;
    expect(r.path).toBe('Schnellerfassung › Schnellerfassung');
    expect(searchSettings(sections, SETTINGS_CATEGORIES, 'ki assistent').length).toBeGreaterThan(0);
  });
});

describe('settings paths', () => {
  it('builds deep links', () => {
    expect(settingsPath('sync')).toBe('/settings/sync');
    expect(settingsPath('sync', 'sync')).toBe('/settings/sync#sync');
    expect(settingsPath('ki', 'ai', 'model')).toBe('/settings/ki#ai--model');
  });

  it('maps the anchors of the old single page', () => {
    expect(legacyTarget('#sync')).toBe('/settings/sync#sync');
    expect(legacyTarget('#developer')).toBe('/settings/entwickler#developer');
    expect(legacyTarget('#startdata')).toBe('/settings/module#modules');
    expect(legacyTarget('#unknown')).toBeUndefined();
    expect(legacyTarget('')).toBeUndefined();
  });
});
