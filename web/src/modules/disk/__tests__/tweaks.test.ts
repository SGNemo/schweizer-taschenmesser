import { afterEach, describe, expect, it } from 'vitest';
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
  resetMessage,
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
  custom: false,
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

  it('knows three honest states of a switch without a known state', () => {
    expect(switchState(tweak({ on: true }))).toBe('on');
    expect(switchState(tweak({ on: false }))).toBe('off');
    // No value yet: Windows decides itself.
    expect(switchState(tweak({ on: null }))).toBe('default');
    // A stored value that is neither on nor off is never called Windows' default.
    expect(switchState(tweak({ on: null, custom: true }))).toBe('custom');
    // Not readable wins over everything: no control at all.
    expect(switchState(tweak({ on: null, readable: false }))).toBe('unreadable');
    expect(switchState(tweak({ on: true, readable: false }))).toBe('unreadable');
    expect(switchState(tweak({ on: null, custom: true, readable: false }))).toBe('unreadable');
  });

  it('folds the outcome of "Alle zurücksetzen" into one notice', () => {
    const title = (id: string) => t.disk.tweaks.title[id] ?? id;
    const x = t.disk.tweaks;
    const none = { restored: [], failed: [], left: [] };
    expect(resetMessage({ ...none, restored: ['animations', 'powerPlan'] }, title, x)).toBe(
      'Zurückgesetzt: Animationen in Fenstern, Energiesparplan.',
    );
    expect(resetMessage({ ...none, left: ['hiddenFiles'] }, title, x)).toBe(
      'Unverändert geblieben: Versteckte Dateien anzeigen (inzwischen in Windows geändert).',
    );
    expect(
      resetMessage(
        { restored: ['animations'], left: ['hiddenFiles'], failed: ['powerPlan'] },
        title,
        x,
      ),
    ).toBe(
      'Zurückgesetzt: Animationen in Fenstern. Unverändert geblieben: Versteckte Dateien anzeigen (inzwischen in Windows geändert), Energiesparplan (ließ sich nicht zurücksetzen).',
    );
    expect(resetMessage(none, title, x)).toBe('Es gab nichts zurückzusetzen.');
    expect(
      resetMessage({ restored: ['a'], left: ['b'], failed: ['c'] }, (id) => id, en.disk.tweaks),
    ).toBe(
      'Reset: a. Left unchanged: b (changed in Windows in the meantime), c (couldn’t be reset).',
    );
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
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B, C');
    expect(joinNames(['A'])).toBe('A');
    expect(joinNames([])).toBe('');
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
        expect(s.riskLow).toBeTruthy();
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
        s.windowsDefault,
        s.customValue,
      ];
      for (const text of texts) {
        expect(text, text).not.toMatch(/!/);
        expect(text, text).not.toMatch(/schneller|beschleunig|boost|turbo|faster|speed/i);
      }
    }
  });

  it('explains without the names of Windows functions or stored values', () => {
    for (const s of [t.disk.tweaks, en.disk.tweaks]) {
      for (const text of [...Object.values(s.what), ...Object.values(s.detail)]) {
        expect(text, text).not.toMatch(
          /SystemParametersInfo|SHGetSetSettings|PowerSetActiveScheme|AdvertisingInfo|Start_TrackProgs|client area|Benutzerwert|user value/i,
        );
      }
    }
    // The plan is the one setting that reaches beyond the own account, and says so up front.
    expect(t.disk.tweaks.what.powerPlan).toContain('alle Konten dieses PCs');
    expect(en.disk.tweaks.what.powerPlan).toContain('all accounts of this PC');
  });

  it('starts every accessible name with the text that is visible', () => {
    for (const s of [t.disk.tweaks, en.disk.tweaks]) {
      expect(s.moreLabel('X').startsWith(s.more)).toBe(true);
      expect(s.sourceLabel('X').startsWith(s.source)).toBe(true);
      expect(s.turnOnLabel('X').startsWith(s.turnOn)).toBe(true);
      expect(s.turnOffLabel('X').startsWith(s.turnOff)).toBe(true);
      expect(s.applyLabel('X').startsWith(s.apply)).toBe(true);
    }
  });

  it('names a setting in the history by its title, a choice without on or off', () => {
    expect(entryText(entry({ on: false }))).toBe('Animationen in Fenstern: ausgeschaltet');
    expect(entryText(entry({ subject: 'powerPlan', on: null, label: 'Ausbalanciert' }))).toBe(
      'Energiesparplan: Ausbalanciert',
    );
    // Without the plan's name the line still ends in a word, never in ": ".
    expect(entryText(entry({ subject: 'powerPlan', on: null }))).toBe('Energiesparplan: geändert');
    expect(entryText(entry({ subject: 'unknownId', on: true }))).toBe('unknownId: eingeschaltet');
  });
});

describe('fake settings', () => {
  const hooks = globalThis as {
    __tmCareChangedElsewhere?: boolean;
    __tmCareResetLeft?: string[];
    __tmCareResetFailed?: string[];
    __tmCareCustom?: string[];
  };
  afterEach(() => {
    delete hooks.__tmCareChangedElsewhere;
    delete hooks.__tmCareResetLeft;
    delete hooks.__tmCareResetFailed;
    delete hooks.__tmCareCustom;
  });

  it('offers undo only at the newest open change of a setting', async () => {
    const o = createFakeDisk().optimize;
    const first = (await o.setTweak('animations', false))!;
    const second = (await o.setTweak('animations', true))!;
    const other = (await o.setTweak('hiddenFiles', true))!;
    const can = async () =>
      Object.fromEntries((await o.history()).entries.map((e) => [e.id, e.canUndo]));
    expect(await can()).toEqual({ [first]: false, [second]: true, [other]: true });
    await expect(o.undo(first)).rejects.toThrow('newer-change');
    // With the newer one taken back, the older one is the newest open change again.
    await o.undo(second);
    expect(await can()).toEqual({ [first]: true, [second]: false, [other]: true });
    await o.undo(first);
    const x = (await o.tweaks()).find((y) => y.id === 'animations')!;
    expect([x.on, x.changedHere]).toEqual([true, false]);
  });

  it('settles every open change of a setting that was changed in Windows since', async () => {
    const o = createFakeDisk().optimize;
    await o.setTweak('animations', false);
    await o.setTweak('animations', true);
    const newest = (await o.setTweak('animations', false))!;
    const other = (await o.setTweak('hiddenFiles', true))!;
    hooks.__tmCareChangedElsewhere = true;
    await expect(o.undo(newest)).rejects.toThrow('changed-elsewhere');
    delete hooks.__tmCareChangedElsewhere;
    const lines = (await o.history()).entries;
    expect(
      lines.filter((e) => e.subject === 'animations').map((e) => [e.stale, e.canUndo, e.undone]),
    ).toEqual([
      [true, false, false],
      [true, false, false],
      [true, false, false],
    ]);
    // The other setting is untouched, and the stale one no longer counts as changed here.
    expect(lines.find((e) => e.id === other)!.canUndo).toBe(true);
    const x = (await o.tweaks()).find((y) => y.id === 'animations')!;
    expect([x.on, x.changedHere]).toEqual([false, false]);
    await expect(o.undo(newest)).rejects.toThrow('changed-elsewhere');
    expect((await o.resetTweaks()).restored).toEqual(['hiddenFiles']);
  });

  it('reports what a reset left alone or could not write', async () => {
    const o = createFakeDisk().optimize;
    await o.setTweak('animations', false);
    await o.setTweak('hiddenFiles', true);
    await o.setTweak('fileExtensions', true);
    hooks.__tmCareResetLeft = ['hiddenFiles'];
    hooks.__tmCareResetFailed = ['fileExtensions'];
    expect(await o.resetTweaks()).toEqual({
      restored: ['animations'],
      left: ['hiddenFiles'],
      failed: ['fileExtensions'],
    });
    const state = async (id: string) => {
      const x = (await o.tweaks()).find((y) => y.id === id)!;
      return [x.on, x.changedHere];
    };
    expect(await state('animations')).toEqual([true, false]);
    // Left: Windows' newer value stands and is no longer "changed here"; its line is settled.
    expect(await state('hiddenFiles')).toEqual([true, false]);
    // Failed: still changed here, still undoable, for another try.
    expect(await state('fileExtensions')).toEqual([true, true]);
    const line = (id: string) => o.history().then((h) => h.entries.find((e) => e.subject === id)!);
    expect((await line('hiddenFiles')).stale).toBe(true);
    expect((await line('hiddenFiles')).canUndo).toBe(false);
    expect((await line('fileExtensions')).canUndo).toBe(true);
    delete hooks.__tmCareResetFailed;
    expect(await o.resetTweaks()).toEqual({ restored: ['fileExtensions'], left: [], failed: [] });
  });

  it('puts a stored value it cannot place back exactly', async () => {
    hooks.__tmCareCustom = ['advertisingId'];
    const o = createFakeDisk().optimize;
    const before = (await o.tweaks()).find((y) => y.id === 'advertisingId')!;
    expect([before.on, before.custom]).toEqual([null, true]);
    const id = (await o.setTweak('advertisingId', false))!;
    const set = (await o.tweaks()).find((y) => y.id === 'advertisingId')!;
    expect([set.on, set.custom]).toEqual([false, false]);
    await o.undo(id);
    const back = (await o.tweaks()).find((y) => y.id === 'advertisingId')!;
    expect([back.on, back.custom, back.changedHere]).toEqual([null, true, false]);
  });

  it('switches, notes the change in the history and takes it back', async () => {
    const o = createFakeDisk().optimize;
    expect(await o.setTweak('fileExtensions', true)).toBe(1);
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
    expect(await o.setTweak('animations', true)).toBeNull();
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
