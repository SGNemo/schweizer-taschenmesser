import { describe, expect, it } from 'vitest';
import {
  buildPlanGrammar,
  compactPlan,
  dayList,
  MAX_PLAN_LINES,
  MAX_PLAN_OPS,
  parsePlanAnswer,
  planSystemPrompt,
  planText,
  planUserMessage,
  type PlanLine,
} from './plan';

// Monday.
const TODAY = '2026-11-09';
const LINES: PlanLine[] = [
  { key: 'todos:steuer', title: 'Steuer', min: 120, prio: 2, due: '2026-11-12', day: '2026-11-09' },
  {
    key: 'todos:keller',
    title: 'Keller  aufräumen\nund streichen',
    min: 60,
    prio: 0,
    day: '2026-11-10',
  },
  { key: 'todos:blog', title: 'Blogpost schreiben', min: 90, prio: 1 },
];

const answer = (ops: unknown[]) => JSON.stringify({ ops });

describe('plan prompt', () => {
  it('lists the plan as key, title, minutes, priority, due and day – one line each, waits for the rest', () => {
    const text = planText(LINES);
    expect(text.split('\n')).toEqual([
      'k1 | Steuer | 120 min | prio 2 | due 2026-11-12 | day Mo 2026-11-09',
      'k2 | Keller aufräumen und streichen | 60 min | prio 0 | day Di 2026-11-10',
      'k3 | Blogpost schreiben | 90 min | prio 1 | waits',
    ]);
  });

  it('caps the plan at 30 lines, planned days first, waiting things last', () => {
    const many: PlanLine[] = Array.from({ length: 40 }, (_, i) => ({
      key: `todos:${i}`,
      title: `Ding ${i}`,
      min: 30,
      prio: 0,
      ...(i % 2 === 0 ? { day: `2026-11-${String(10 + (i % 7)).padStart(2, '0')}` } : {}),
    }));
    const plan = compactPlan(many);
    expect(plan).toHaveLength(MAX_PLAN_LINES);
    expect(plan.filter((l) => l.day).length).toBe(20);
    expect(plan.slice(0, 20).every((l) => l.day)).toBe(true);
    for (let i = 1; i < 20; i++) expect(plan[i]!.day! >= plan[i - 1]!.day!).toBe(true);
  });

  it('puts today, the day list, the plan and the sentence last into the user message', () => {
    const msg = planUserMessage(LINES, '  schieb  Steuer auf Freitag ', TODAY);
    expect(msg.startsWith('Heute: 2026-11-09 (Montag)')).toBe(true);
    expect(msg).toContain('Tage: Mo 2026-11-09, Di 2026-11-10, Mi 2026-11-11');
    expect(msg.indexOf('Plan:')).toBeLessThan(msg.indexOf('k1 | Steuer'));
    expect(msg.endsWith('Satz: schieb Steuer auf Freitag')).toBe(true);
    expect(dayList(TODAY).split(', ')).toHaveLength(14);
    expect(planUserMessage([], 'x', TODAY)).toContain('Plan:\n(leer)');
  });

  it('system prompt is stable, names the six ops and ends with examples that answer JSON only', () => {
    const sys = planSystemPrompt();
    expect(planSystemPrompt()).toBe(sys);
    for (const op of ['pin', 'exclude', 'priority', 'duration', 'available', 'block'])
      expect(sys).toContain(`"op":"${op}"`);
    expect(sys).toContain('answer {"ops":[]}');
    expect(sys.indexOf('Examples:')).toBeLessThan(sys.lastIndexOf('Ausgabe: {"ops":'));
    // No module schema, no actions of other modules: the planner's prompt is its own.
    expect(sys).not.toContain('Modules and fields');
    expect(sys).not.toMatch(/\btodos\b|\bcalendar\b|\bfinance\b/);
  });
});

describe('plan grammar', () => {
  it('allows at most 8 ops of the six kinds and only the plan’s keys', () => {
    const g = buildPlanGrammar(3);
    expect(g).toContain(`root ::= "{" "\\"ops\\":" "[" (op ("," op){0,${MAX_PLAN_OPS - 1}})? "]}"`);
    expect(g).toContain('op ::= pin | exclude | priority | duration | available | block');
    expect(g).toContain('key ::= "\\"k1\\"" | "\\"k2\\"" | "\\"k3\\""');
    expect(g).not.toContain('"k4"');
    expect(g).toContain('date ::= "\\"" [0-9]{4} "-" [0-9]{2} "-" [0-9]{2} "\\""');
    // Every repetition is bounded: no `*` or `+` anywhere.
    expect(g).not.toMatch(/[\]})]\s*[*+]/);
  });

  it('without a thing in the plan only the day ops remain', () => {
    const g = buildPlanGrammar(0);
    expect(g).toContain('op ::= available | block');
    expect(g).not.toContain('key ::=');
    expect(g).not.toContain('pin ::=');
  });
});

describe('parsePlanAnswer', () => {
  it('turns the six ops into engine ops, keys resolved against the plan', () => {
    const ops = parsePlanAnswer(
      answer([
        { op: 'pin', key: 'k1', value: '2026-11-13' },
        { op: 'exclude', key: 'k2', value: true },
        { op: 'priority', key: 'k3', value: 3 },
        { op: 'duration', key: 'k1', value: 60 },
        { op: 'available', date: '2026-11-11', value: 120 },
        { op: 'block', date: '2026-11-12', value: '14:00-16:00 Werkstatt  Nord' },
      ]),
      LINES,
      TODAY,
    );
    expect(ops).toEqual([
      { op: 'pin', key: 'todos:steuer', date: '2026-11-13' },
      { op: 'exclude', key: 'todos:keller' },
      { op: 'priority', key: 'todos:blog', value: 3 },
      { op: 'duration', key: 'todos:steuer', min: 60 },
      { op: 'available', date: '2026-11-11', min: 120 },
      {
        op: 'block',
        date: '2026-11-12',
        from: '14:00',
        to: '16:00',
        min: 120,
        label: 'Werkstatt Nord',
      },
    ]);
  });

  it('an empty list is a valid "no instruction"', () => {
    expect(parsePlanAnswer(answer([]), LINES, TODAY)).toEqual([]);
  });

  it.each([
    ['not json', 'nope'],
    ['a key outside the plan', answer([{ op: 'pin', key: 'k4', value: '2026-11-13' }])],
    ['a key that is no alias', answer([{ op: 'exclude', key: 'todos:steuer', value: true }])],
    ['a day before today', answer([{ op: 'pin', key: 'k1', value: '2026-11-08' }])],
    ['a day that does not exist', answer([{ op: 'available', date: '2026-11-31', value: 0 }])],
    ['a day more than a year ahead', answer([{ op: 'available', date: '2027-12-01', value: 0 }])],
    ['too many minutes', answer([{ op: 'available', date: '2026-11-11', value: 1441 }])],
    ['a zero duration', answer([{ op: 'duration', key: 'k1', value: 0 }])],
    [
      'a window that runs backwards',
      answer([{ op: 'block', date: '2026-11-12', value: '16:00-14:00 X' }]),
    ],
    [
      'a window without a label',
      answer([{ op: 'block', date: '2026-11-12', value: '14:00-16:00 ' }]),
    ],
    ['an unknown op', answer([{ op: 'delete', key: 'k1', value: true }])],
    ['a priority other than 3', answer([{ op: 'priority', key: 'k1', value: 2 }])],
    [
      'nine ops',
      answer(Array.from({ length: 9 }, () => ({ op: 'exclude', key: 'k1', value: true }))),
    ],
    [
      'one bad op among good ones',
      answer([
        { op: 'pin', key: 'k1', value: '2026-11-13' },
        { op: 'pin', key: 'k9', value: '2026-11-13' },
      ]),
    ],
  ])('rejects %s as a whole', (_name, text) => {
    expect(parsePlanAnswer(text, LINES, TODAY)).toBeUndefined();
  });
});
