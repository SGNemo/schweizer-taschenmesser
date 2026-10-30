import { describe, expect, it } from 'vitest';
import { t } from '@/strings';
import { proposeSteps } from '../stepTemplates';

describe('proposeSteps', () => {
  it('picks a template by keyword in the title, ignoring case and accents', () => {
    const a = proposeSteps('Hausarbeit Statistik');
    const b = proposeSteps('PRÄSENTATION vorbereiten');
    expect(a.matched).toBe(true);
    expect(a.steps).toEqual(b.steps);
    expect(a.steps).not.toEqual(t.focus.mode.stepsTemplate);
  });

  it('gives different steps for different kinds of tasks', () => {
    const form = proposeSteps('Formular ausfüllen').steps;
    const call = proposeSteps('Zahnarzt anrufen').steps;
    expect(form).not.toEqual(call);
  });

  it('falls back to the generic steps and says so', () => {
    const r = proposeSteps('Xyzzy');
    expect(r.matched).toBe(false);
    expect(r.steps).toEqual(t.focus.mode.stepsTemplate);
  });

  it('every template has three steps and at least one keyword', () => {
    for (const set of t.focus.mode.stepSets) {
      expect(set.steps).toHaveLength(3);
      expect(set.words.length).toBeGreaterThan(0);
    }
  });
});
