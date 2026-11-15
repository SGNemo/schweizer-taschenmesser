import { describe, expect, it } from 'vitest';
import { createFakeDisk } from '@/core/platform/fakeDisk';
import type { CareEntry, TweakState } from '@/core/platform/optimize';
import { en } from '@/i18n/locales/en';
import { t } from '@/strings';
import { entryText } from '../components/HistoryTab';
import {
  changedHere,
  choiceLabel,
  groupTweaks,
  isMicrosoftSource,
  joinNames,
  switchState,
} from '../logic/tweaks';

const tweak = (over: Partial<TweakState>): TweakState => ({
  id: 'animations',
  group: 'appearance',
  kind: 'toggle',
  on: true,
  choice: null,
  options: [],
  changedHere: false,
  applicable: true,
  readable: true,
  risk: 'none',
  sourceUrl: 'https://learn.microsoft.com/x',
  refresh: 'none',
  ...over,
});

const entry = (over: Partial<CareEntry>): CareEntry => ({
  id: 1,
  at: 0,
  kind: 'tweak',
  subject: 'animations',
  label: '',
  bytes: 0,
  files: 0,
  permanent: false,
  on: false,
  canUndo: true,
  undone: false,
  ...over,
});

describe('tweak logic', () => {
  it('groups in a fixed order and hides what does not exist on this Windows', () => {
    const groups = groupTweaks([
      tweak({ id: 'powerPlan', group: 'power' }),
      tweak({ id: 'advertisingId', group: 'privacy', applicable: false }),
      tweak({ id: 'hiddenFiles', group: 'explorer' }),
      tweak({ id: 'animations' }),
      tweak({ id: 'fileExtensions', group: 'explorer' }),
    ]);
    expect(groups.map((g) => g.group)).toEqual(['appearance', 'explorer', 'power']);
    expect(groups[1]!.items.map((x) => x.id)).toEqual(['hiddenFiles', 'fileExtensions']);
    expect(groupTweaks([])).toEqual([]);
  });

  it('knows a switch that has no value yet from one that is off', () => {
    expect(switchState(tweak({ on: true }))).toBe('on');
    expect(switchState(tweak({ on: false }))).toBe('off');
    expect(switchState(tweak({ on: null }))).toBe('default');
  });

  it('lists what was changed here and names the active choice', () => {
    const list = [tweak({ id: 'a', changedHere: true }), tweak({ id: 'b' })];
    expect(changedHere(list).map((x) => x.id)).toEqual(['a']);
    const plan = tweak({
      kind: 'choice',
      choice: 'p2',
      options: [
        { id: 'p1', label: 'Ausbalanciert' },
        { id: 'p2', label: 'Energiesparmodus' },
      ],
    });
    expect(choiceLabel(plan)).toBe('Energiesparmodus');
    expect(choiceLabel({ ...plan, choice: 'gone' })).toBe('');
    expect(joinNames(['A', 'B'])).toBe('A, B');
  });

  it('opens only Microsoft documentation pages as a source', () => {
    expect(isMicrosoftSource('https://learn.microsoft.com/windows/x')).toBe(true);
    expect(isMicrosoftSource('https://support.microsoft.com/x')).toBe(true);
    for (const bad of [
      'http://learn.microsoft.com/x',
      'https://learn.microsoft.com.example.org/x',
      'https://example.org/learn.microsoft.com',
      'javascript:alert(1)',
      'file:///c:/x',
      '',
    ])
      expect(isMicrosoftSource(bad), bad).toBe(false);
  });
});

describe('tweak texts', () => {
  it('has a title, a sentence and details for every setting of the catalogue, in both languages', async () => {
    const list = await createFakeDisk().optimize.tweaks();
    expect(list.map((x) => x.id)).toEqual([
      'animations',
      'dragFullWindows',
      'pointerSonar',
      'fileExtensions',
      'hiddenFiles',
      'advertisingId',
      'trackAppLaunches',
      'powerPlan',
    ]);
    for (const x of list) {
      for (const s of [t.disk.tweaks, en.disk.tweaks]) {
        expect(s.title[x.id], x.id).toBeTruthy();
        expect(s.what[x.id], x.id).toBeTruthy();
        expect(s.detail[x.id], x.id).toBeTruthy();
        expect(s.group[x.group], x.group).toBeTruthy();
        expect(s.risk[x.risk], x.risk).toBeTruthy();
        // A risk above "none" always says what the risk is.
        if (x.risk !== 'none') expect(s.riskNote[x.id], x.id).toBeTruthy();
      }
      expect(isMicrosoftSource(x.sourceUrl), x.id).toBe(true);
    }
  });

  it('promises nothing and stays calm', () => {
    for (const s of [t.disk.tweaks, en.disk.tweaks]) {
      const texts = [
        s.lead,
        s.restorePointHint,
        ...Object.values(s.title),
        ...Object.values(s.what),
        ...Object.values(s.detail),
        ...Object.values(s.riskNote),
      ];
      for (const text of texts) {
        expect(text, text).not.toMatch(/!/);
        expect(text, text).not.toMatch(/schneller|beschleunig|boost|turbo|faster|speed/i);
      }
    }
  });

  it('names a setting in the history by its title, a choice without on or off', () => {
    expect(entryText(entry({ on: false }))).toBe('Animationen in Fenstern: ausgeschaltet');
    expect(entryText(entry({ subject: 'powerPlan', on: null }))).toBe('Energiesparplan: geändert');
    expect(entryText(entry({ subject: 'unknownId', on: true }))).toBe('unknownId: eingeschaltet');
  });
});

describe('fake settings', () => {
  it('switches, notes the change in the history and takes it back', async () => {
    const o = createFakeDisk().optimize;
    await o.setTweak('fileExtensions', true);
    let x = (await o.tweaks()).find((y) => y.id === 'fileExtensions')!;
    expect([x.on, x.changedHere]).toEqual([true, true]);
    const line = (await o.history()).entries[0]!;
    expect([line.kind, line.subject, line.on, line.canUndo]).toEqual([
      'tweak',
      'fileExtensions',
      true,
      true,
    ]);
    await o.undo(line.id);
    x = (await o.tweaks()).find((y) => y.id === 'fileExtensions')!;
    expect([x.on, x.changedHere]).toEqual([false, false]);
  });

  it('does nothing when the state is already so and refuses what it does not know', async () => {
    const o = createFakeDisk().optimize;
    await o.setTweak('animations', true);
    expect((await o.history()).entries).toEqual([]);
    await expect(o.setTweak('nope', true)).rejects.toThrow('unknown-tweak');
    await expect(o.setTweak('animations', 'x')).rejects.toThrow('bad-target');
    await expect(o.setTweak('powerPlan', 'not-a-plan')).rejects.toThrow('bad-target');
  });

  it('resets everything to the state before the first change', async () => {
    const o = createFakeDisk().optimize;
    await o.setTweak('animations', false);
    await o.setTweak('animations', true);
    await o.setTweak('animations', false);
    await o.setTweak('trackAppLaunches', false);
    await o.setTweak('powerPlan', 'a1841308-3541-4fab-bc81-f71556f20b4a');
    const report = await o.resetTweaks();
    expect(report.restored.sort()).toEqual(['animations', 'powerPlan', 'trackAppLaunches']);
    const list = await o.tweaks();
    expect(list.every((x) => !x.changedHere)).toBe(true);
    expect(list.find((x) => x.id === 'animations')!.on).toBe(true);
    expect(list.find((x) => x.id === 'trackAppLaunches')!.on).toBeNull();
    expect(list.find((x) => x.id === 'powerPlan')!.choice).toBe(
      '381b4222-f694-41f0-9685-ff5bb260df2e',
    );
    expect((await o.history()).entries.every((e) => !e.canUndo && e.undone)).toBe(true);
    expect(await o.resetTweaks()).toEqual({ restored: [], failed: [], left: [] });
  });
});
