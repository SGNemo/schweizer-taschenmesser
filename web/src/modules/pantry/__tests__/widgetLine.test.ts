import { afterEach, describe, expect, it } from 'vitest';
import { loadCatalog } from '@/core/i18n/catalogs';
import { setLang } from '@/core/i18n/lang';
import { widgetLine } from '../logic';

afterEach(() => setLang('de'));

describe('pantry widget: calm context line', () => {
  it('names "nothing expires" first when only stock runs low', () => {
    expect(widgetLine(0, 0, 2)).toBe('Nichts läuft ab · 2 werden knapp');
  });

  it('keeps the counts when something expires', () => {
    expect(widgetLine(1, 2, 0)).toBe('1 abgelaufen · 2 laufen bald ab');
    expect(widgetLine(0, 0, 0)).toBe('Nichts läuft ab, nichts wird knapp.');
  });

  it('en: low stock keeps its count', async () => {
    await loadCatalog('en');
    setLang('en');
    expect(widgetLine(0, 0, 2)).toContain('2');
  });
});
