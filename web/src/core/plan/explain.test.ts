import { afterEach, describe, expect, it } from 'vitest';
import { loadCatalog } from '@/core/i18n/catalogs';
import { ACTIVE_LOCALES, setLang } from '@/core/i18n/lang';
import { dayName, explainAssignment, explainWait } from './explain';
import type { PlaceReason } from './types';

afterEach(() => setLang('de'));
const nameOf = (id: string) =>
  ({ 'todos:a#1': 'Steuer · Teil 2/2', 'todos:j#0': 'Steuerbescheid' })[id] ?? id;

describe('explain', () => {
  it('names the day in the German sentences', () => {
    expect(dayName('2026-11-12')).toBe('Do');
    expect(explainAssignment({ reason: 'deadline' }, { due: '2026-11-12', nameOf })).toBe(
      'muss bis Do fertig sein',
    );
    expect(explainAssignment({ reason: 'carried' }, { prevDate: '2026-11-10', nameOf })).toBe(
      'weiter von Di',
    );
    expect(
      explainAssignment({ reason: 'bumped', bumpedBy: ['todos:j#0', 'todos:a#1'] }, { nameOf }),
    ).toBe('Platz nahmen Steuerbescheid, Steuer · Teil 2/2');
    expect(explainAssignment({ reason: 'after-part', bumpedBy: ['todos:a#1'] }, { nameOf })).toBe(
      'folgt auf Steuer · Teil 2/2',
    );
    expect(explainWait({ reason: 'horizon' }, nameOf)).toBe('keine freie Zeit im Planungszeitraum');
    expect(explainWait({ reason: 'horizon', bumpedBy: ['todos:j#0'] }, nameOf)).toBe(
      'Platz nahmen Steuerbescheid',
    );
  });

  it('has a sentence for every reason and wait state in all five languages', async () => {
    const reasons: PlaceReason[] = [
      'pinned',
      'deadline',
      'deadline-buffer',
      'new',
      'kept',
      'carried',
      'pulled',
      'bumped',
      'after-part',
      'capacity',
    ];
    for (const lang of ACTIVE_LOCALES) {
      await loadCatalog(lang);
      setLang(lang);
      const seen = new Set<string>();
      for (const reason of reasons) {
        const text = explainAssignment(
          { reason, bumpedBy: ['todos:j#0'] },
          { due: '2026-11-12', prevDate: '2026-11-10', nameOf },
        );
        expect(text, `${lang} ${reason}`).toMatch(/\S/);
        expect(text, `${lang} ${reason}`).not.toContain('undefined');
        seen.add(text);
      }
      expect(seen.size, lang).toBe(reasons.length);
      for (const w of ['horizon', 'too-long', 'after-hard-due'] as const)
        expect(explainWait({ reason: w }, nameOf), `${lang} ${w}`).toMatch(/\S/);
      // The day name follows the language and never ends in a period.
      expect(dayName('2026-11-12'), lang).toMatch(/^[^.]+$/);
    }
  });
});
