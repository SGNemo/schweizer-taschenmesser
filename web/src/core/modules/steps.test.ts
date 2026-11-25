/**
 * A thing's steps as core hands them to the planner (planner hub 2, package 5a): well-formed and at most `STEPS_MAX`,
 * else none at all – a cut list would read „40 von 40“ or end the thing with steps still open.
 */
import { describe, expect, it } from 'vitest';
import { withSteps } from './contributions';
import { STEPS_MAX, type PlannableItem } from './types';

const thing = (steps?: unknown): PlannableItem =>
  ({
    id: 'a',
    kind: 'task',
    title: 'Haushalt',
    to: '/todos',
    ...(steps ? { steps } : {}),
  }) as PlannableItem;
const step = (i: number, done = false) => ({ id: `s${i}`, title: `Schritt ${i}`, done });

describe('steps through core', () => {
  it('keeps up to STEPS_MAX well-formed steps', () => {
    const steps = Array.from({ length: STEPS_MAX }, (_, i) => step(i, i < 3));
    expect(withSteps(thing(steps)).steps).toHaveLength(STEPS_MAX);
    expect(withSteps(thing())).not.toHaveProperty('steps');
  });

  it('drops a longer list whole (no „Los“ that would end the thing with steps open)', () => {
    const steps = Array.from({ length: STEPS_MAX + 1 }, (_, i) => step(i, i < STEPS_MAX));
    const out = withSteps(thing(steps));
    expect(out).not.toHaveProperty('steps');
    expect(out.title).toBe('Haushalt');
  });

  it('drops malformed or empty steps', () => {
    expect(withSteps(thing([{ id: 's1', title: 3, done: false }]))).not.toHaveProperty('steps');
    expect(withSteps(thing([]))).not.toHaveProperty('steps');
  });
});
