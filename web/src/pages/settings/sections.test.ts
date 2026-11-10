import { describe, expect, it } from 'vitest';
import { availableManifests } from '@/core/modules/available';
import { allManifests } from '@/core/modules/registry';
import { META_SECTION_IDS, levelOf, scopeOf } from '@/core/settings/registry/meta';
import { visibleSections } from '@/core/settings/registry/registry';
import { SETTINGS_CATEGORY_IDS, type SettingsContext } from '@/core/settings/registry/types';
import { allSettingsSections } from './useSections';

const ctx = (over: Partial<SettingsContext> = {}): SettingsContext => ({
  platform: 'desktop',
  isDev: false,
  isModuleEnabled: () => true,
  showPreview: false,
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

describe('preview sections (maturity)', () => {
  const PREVIEW = [
    'localapi',
    'share',
    'browser-extension',
    'reading',
    'voice',
    'automation',
    'automation-log',
    'remote',
  ];
  // All manifests (not only those of the web platform): desktop-only preview modules count too.
  const all = allSettingsSections(allManifests.filter((m) => !m.retired));
  const ids = (c: SettingsContext) => visibleSections(all, c).map((s) => s.id);

  it('are hidden by default and listed with "In Arbeit anzeigen"', () => {
    const hidden = ids(ctx());
    for (const id of PREVIEW) expect(hidden, id).not.toContain(id);
    const shown = ids(ctx({ showPreview: true }));
    for (const id of PREVIEW) expect(shown, id).toContain(id);
  });

  it('"Was ging wohin?" (connection log, network block, what can go out) is visible by default (D11)', () => {
    expect(ids(ctx())).toContain('network');
  });

  it('stay reachable while in use, one by one', () => {
    for (const id of ['localapi', 'share', 'reading', 'voice']) {
      expect(ids(ctx({ inUse: { [id]: true } })), id).toContain(id);
    }
  });

  it('an enabled preview module keeps its settings section', () => {
    // Only modules of this platform have sections (desktop-only previews like the browser are not listed on the web).
    const preview = availableManifests().filter(
      (m) => m.maturity === 'preview' && m.settings.fields.length > 0,
    );
    expect(preview.map((m) => m.id)).toContain('chat');
    for (const m of preview) {
      expect(ids(ctx({ isModuleEnabled: (id) => id === m.id }))).toContain(`module-${m.id}`);
      expect(ids(ctx({ isModuleEnabled: () => false }))).not.toContain(`module-${m.id}`);
    }
  });
});

describe('section placement (scope, Erweitert)', () => {
  const all = allSettingsSections(allManifests.filter((m) => !m.retired));

  it('names only sections that exist', () => {
    const ids = new Set(all.map((s) => s.id));
    for (const id of META_SECTION_IDS) expect(ids.has(id), id).toBe(true);
  });

  it('keeps what is needed daily in Basis: nothing about the look, sync, backup, notifications or the vault is Erweitert', () => {
    for (const id of [
      'appearance',
      'reading',
      'focus',
      'sync',
      'backup',
      'notifications',
      'calm-reminders',
      'general',
      'updates',
      'module-accounts',
    ]) {
      expect(levelOf({ id }), id).toBe('basic');
    }
  });

  it('labels module settings as synced and the look as device-local', () => {
    expect(scopeOf({ id: 'module-todos' })).toBe('synced');
    expect(scopeOf({ id: 'appearance' })).toBe('local');
    expect(scopeOf({ id: 'licenses' })).toBeUndefined();
  });
});
