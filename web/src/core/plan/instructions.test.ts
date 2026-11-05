import { describe, expect, it } from 'vitest';
import { parseInstruction, resolveDay, type InstructionContext, type PlanOp } from './instructions';

// Monday, 2 November 2026: Do = 5.11., Fr = 6.11., nächster Donnerstag = 12.11.
const TODAY = '2026-11-02';
const ctx: InstructionContext = {
  today: TODAY,
  items: [
    { key: 'todos:steuer', title: 'Steuer', date: '2026-11-05' },
    {
      key: 'todos:bescheid',
      title: 'Steuerbescheid prüfen',
      date: '2026-11-05',
      hardDue: '2026-11-05',
    },
    { key: 'todos:blog', title: 'Blogpost schreiben', date: '2026-11-04' },
    { key: 'todos:keller1', title: 'Keller aufräumen', date: '2026-11-03' },
    { key: 'todos:keller2', title: 'Keller streichen' },
    { key: 'todos:rad', title: 'Fahrrad reparieren', date: '2026-11-05' },
    { key: 'todos:mueller', title: 'Müller anrufen' },
  ],
};
const ops = (text: string): PlanOp[] => {
  const r = parseInstruction(text, ctx);
  if (r.kind !== 'ops') throw new Error(`${text}: ${r.kind}`);
  return r.ops;
};
const kind = (text: string) => parseInstruction(text, ctx).kind;

describe('parseInstruction – days', () => {
  it.each([
    ['Donnerstag frei', '2026-11-05'],
    ['Do frei', '2026-11-05'],
    ['am Donnerstag nichts', '2026-11-05'],
    ['Freitag keine Zeit', '2026-11-06'],
    ['morgen frei', '2026-11-03'],
    ['Übermorgen frei', '2026-11-04'],
    ['uebermorgen frei', '2026-11-04'],
    ['10.11. frei', '2026-11-10'],
  ])('%s → day off', (text, date) => {
    expect(ops(text)).toEqual([{ op: 'available', date, min: 0 }]);
  });

  it('„nächsten Donnerstag“ is next week, in every umlaut spelling', () => {
    for (const text of [
      'nächsten Donnerstag frei',
      'naechsten Donnerstag frei',
      'nachsten Donnerstag frei',
    ])
      expect(ops(text)).toEqual([{ op: 'available', date: '2026-11-12', min: 0 }]);
  });

  it.each([
    ['Donnerstag nur zwei Stunden', 120],
    ['Mi 3 h', 180],
    ['Freitag nur 90 Minuten', 90],
    ['morgen 1,5 Std', 90],
  ])('%s → available minutes', (text, min) => {
    expect(ops(text)[0]).toMatchObject({ op: 'available', min });
  });

  it('a window with a label is a blocker (end-time extractor)', () => {
    expect(ops('Donnerstag 14 bis 16 Uhr Werkstatt')).toEqual([
      {
        op: 'block',
        date: '2026-11-05',
        from: '14:00',
        to: '16:00',
        min: 120,
        label: 'Werkstatt',
      },
    ]);
    expect(ops('Fr 9:30-11 Uhr Zahnarzt Dr. Böhm')[0]).toMatchObject({
      from: '09:30',
      to: '11:00',
      min: 90,
      label: 'Zahnarzt Dr. Böhm',
    });
  });
});

describe('parseInstruction – things', () => {
  it('schieb X auf <Tag> pins it', () => {
    expect(ops('schieb Steuer auf Freitag')).toEqual([
      { op: 'pin', key: 'todos:steuer', date: '2026-11-06' },
    ]);
    expect(ops('verschiebe den Blogpost nach Do')).toEqual([
      { op: 'pin', key: 'todos:blog', date: '2026-11-05' },
    ]);
  });

  it('X auf <Tag> pins a known thing, an unknown one is no instruction', () => {
    expect(ops('Fahrrad auf Samstag')).toEqual([
      { op: 'pin', key: 'todos:rad', date: '2026-11-07' },
    ]);
    expect(kind('Reifen auf Samstag')).toBe('none');
  });

  it('X erst nächste Woche / erst ab Do sets the earliest day', () => {
    expect(ops('Blogpost erst nächste Woche')).toEqual([
      { op: 'earliest', key: 'todos:blog', date: '2026-11-09' },
    ]);
    expect(ops('Fahrrad erst ab Freitag')).toEqual([
      { op: 'earliest', key: 'todos:rad', date: '2026-11-06' },
    ]);
  });

  it('zuerst / heute / wichtig', () => {
    expect(ops('Steuer zuerst')).toEqual([{ op: 'pin', key: 'todos:steuer', date: TODAY }]);
    expect(ops('Blogpost heute')).toEqual([{ op: 'pin', key: 'todos:blog', date: TODAY }]);
    expect(ops('Fahrrad wichtig')).toEqual([{ op: 'priority', key: 'todos:rad', value: 3 }]);
  });

  it('nicht planen / raus excludes', () => {
    expect(ops('Blogpost nicht planen')).toEqual([{ op: 'exclude', key: 'todos:blog' }]);
    expect(ops('Fahrrad raus')).toEqual([{ op: 'exclude', key: 'todos:rad' }]);
    // „Müll raus“ is a ToDo: nothing in the plan is called that.
    expect(kind('Müll raus')).toBe('none');
  });

  it('dauert / a bare duration set the minutes', () => {
    expect(ops('Steuer dauert 45 Minuten')).toEqual([
      { op: 'duration', key: 'todos:steuer', min: 45 },
    ]);
    expect(ops('Blogpost 2 Std')).toEqual([{ op: 'duration', key: 'todos:blog', min: 120 }]);
  });

  it('a typo of one letter still finds the thing (withinOneEdit)', () => {
    expect(ops('schieb Blogpsot auf Fr')).toEqual([
      { op: 'pin', key: 'todos:blog', date: '2026-11-06' },
    ]);
  });

  it('umlauts are folded when matching a thing', () => {
    expect(ops('Mueller anrufen wichtig')).toEqual([
      { op: 'priority', key: 'todos:mueller', value: 3 },
    ]);
    expect(ops('schieb Keller aufraumen auf Do')).toEqual([
      { op: 'pin', key: 'todos:keller1', date: '2026-11-05' },
    ]);
  });

  it('two equally good things → „Meinst du A oder B?“, never a guess', () => {
    const r = parseInstruction('schieb Keller auf Freitag', ctx);
    expect(r.kind).toBe('ask');
    if (r.kind !== 'ask') return;
    expect(r.options.map((o) => o.title).sort()).toEqual(['Keller aufräumen', 'Keller streichen']);
    expect(r.ops('todos:keller2')).toEqual([
      { op: 'pin', key: 'todos:keller2', date: '2026-11-06' },
    ]);
  });

  it('a planning verb naming nothing in the plan says so', () => {
    expect(parseInstruction('schieb Steuererklärung 2025 auf Fr', ctx)).toEqual({
      kind: 'missing',
      query: 'steuererklärung 2025',
    });
  });
});

describe('parseInstruction – the whole day and runs', () => {
  it('alles von Do nach Fr: Do free, its things not before Fr – a hard due stays first', () => {
    expect(ops('alles von Do nach Fr')).toEqual([
      { op: 'available', date: '2026-11-05', min: 0 },
      { op: 'earliest', key: 'todos:steuer', date: '2026-11-06' },
      { op: 'earliest', key: 'todos:rad', date: '2026-11-06' },
    ]);
  });

  it('schieb alles von Donnerstag auf Freitag / Do frei, alles nach Fr', () => {
    expect(ops('schieb alles von Donnerstag auf Freitag')).toEqual(ops('alles von Do nach Fr'));
    expect(ops('Do frei, alles nach Fr')).toEqual(ops('alles von Do nach Fr'));
  });

  it('a target day before the source day is explained, not guessed', () => {
    expect(kind('alles von Fr nach Mo')).toBe('ops');
    expect(kind('alles von Fr auf Do')).toBe('explain');
  });

  it('neu verteilen runs calmly, alles neu mischen starts from prev = []', () => {
    expect(ops('neu verteilen')).toEqual([{ op: 'replan', reshuffle: false }]);
    expect(ops('Alles neu mischen!')).toEqual([{ op: 'replan', reshuffle: true }]);
  });

  it('Puffer 30 % is a setting; an unsupported step is explained', () => {
    expect(ops('Puffer 30 %')).toEqual([{ op: 'buffer', pct: 30 }]);
    expect(kind('Puffer 25 Prozent')).toBe('explain');
  });
});

describe('parseInstruction – never guesses', () => {
  it.each([
    'Steuer 2 Std bis Do',
    'Zahnarzt anrufen',
    'Milch kaufen morgen',
    'Keller',
    'Leggings kaufen',
    'Schiebetür ölen',
    'Puffer tauschen',
    'Legosteine aufräumen auf Montag',
  ])('%s is no instruction (a ToDo)', (text) => {
    expect(kind(text)).toBe('none');
  });

  it.each(['schieb das irgendwie', 'Dontag frei', 'neu verteilen bitte morgen'])(
    '%s has a known verb but cannot be read → explain',
    (text) => {
      expect(kind(text)).toBe('explain');
    },
  );

  it('resolves day words like the quick-capture parser', () => {
    expect(resolveDay('do', TODAY)).toBe('2026-11-05');
    expect(resolveDay('nächsten donnerstag', TODAY)).toBe('2026-11-12');
    expect(resolveDay('31.11.', TODAY)).toBeUndefined();
  });
});
