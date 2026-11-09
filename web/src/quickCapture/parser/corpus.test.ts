import { describe, expect, it } from 'vitest';
import { CORPUS, CORPUS_NOW, type CorpusCase } from './corpus';
import { parseCapture, type CaptureResult } from './index';

type Flat = Omit<CorpusCase, 'from' | 'text' | 'fitness' | 'place'>;

/** Stand-in for the offline city search (the parser folder imports nothing from outside). */
const KNOWN = new Set(['tokio', 'new york', 'lisbon']);
const isPlace = (name: string) => KNOWN.has(name.toLowerCase());

/** The corpus fields a result offers; fields the parser does not know yet are simply absent. */
function flatten(r: CaptureResult): Flat {
  const f = r.fields;
  return {
    type: r.type,
    date: f.date,
    time: f.time,
    endTime: f.endTime,
    title: f.title,
    recurrence: f.recurrence,
    amountMinor: f.amountMinor,
    kind: f.kind,
    priority: f.priority,
    estimateMin: f.estimateMin,
    pin: f.pin,
    startDate: f.startDate,
    hardDue: f.hardDue,
  };
}

function misses(c: CorpusCase): string[] {
  const fitness = c.fitness ? { meal: true, workout: true } : undefined;
  const place = c.place ? isPlace : undefined;
  const got = flatten(parseCapture(c.text, { now: CORPUS_NOW, fitness, place }));
  const { from: _from, text: _text, fitness: _fitness, place: _place, ...want } = c;
  void _from;
  void _text;
  void _fitness;
  void _place;
  return (Object.keys(want) as (keyof Flat)[]).filter(
    (k) => JSON.stringify(got[k]) !== JSON.stringify(want[k]),
  );
}

// Ratchet: raise this when the parser gets better, never lower it.
const MIN_HITS = 40;

describe('parser corpus (QA sentences)', () => {
  it('reports the hit rate', () => {
    const rows = CORPUS.map((c) => ({ c, miss: misses(c) }));
    const hits = rows.filter((r) => r.miss.length === 0).length;
    const fields = rows.flatMap((r) =>
      Object.keys(r.c).filter(
        (k) => k !== 'from' && k !== 'text' && k !== 'fitness' && k !== 'place',
      ),
    );
    const missed = rows.reduce((n, r) => n + r.miss.length, 0);
    console.info(
      `corpus: ${hits}/${CORPUS.length} sentences fully right, ${fields.length - missed}/${fields.length} fields right`,
    );
    for (const r of rows)
      if (r.miss.length) console.info(`  ✗ ${r.c.from} "${r.c.text}": ${r.miss.join(', ')}`);
    expect(hits).toBeGreaterThanOrEqual(MIN_HITS);
  });
});
