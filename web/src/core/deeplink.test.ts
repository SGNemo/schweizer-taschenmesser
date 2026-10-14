import { describe, expect, it } from 'vitest';
import { parseAppLink, toAppLink } from './deeplink';
import { settingsPath } from './settings/registry/paths';

describe('nemo:// deep links', () => {
  it('maps settings, library and tools addresses to in-app routes', () => {
    expect(parseAppLink('nemo://settings/darstellung')).toBe('/settings/darstellung');
    expect(parseAppLink('nemo://settings/darstellung/appearance')).toBe(
      '/settings/darstellung#appearance',
    );
    expect(parseAppLink('nemo://settings/darstellung/appearance/theme')).toBe(
      '/settings/darstellung#appearance--theme',
    );
    expect(parseAppLink('nemo://library')).toBe('/library');
    expect(parseAppLink('nemo://library/todos')).toBe('/library#module-todos');
    expect(parseAppLink('nemo://tools/calc')).toBe('/tools#tool-calc');
  });

  it('refuses everything that is not a plain id or a known category', () => {
    for (const bad of [
      'https://example.org/settings/ki',
      'nemo://settings/unbekannt',
      'nemo://settings/ki/../sync',
      'nemo://settings/ki/ai/model/extra',
      'nemo://library/a/b',
      'nemo://tools/%2e%2e',
      'nemo://settings/ki/ai?x=1',
      'nemo://vault/unlock',
      'nemo://',
    ])
      expect(parseAppLink(bad), bad).toBeUndefined();
  });

  it('round-trips the paths built by settingsPath', () => {
    for (const p of [
      settingsPath('sync'),
      settingsPath('sync', 'backup'),
      settingsPath('ki', 'ai', 'model'),
      '/library#module-todos',
      '/tools#tool-timer',
    ])
      expect(parseAppLink(toAppLink(p)!), p).toBe(p);
  });
});
