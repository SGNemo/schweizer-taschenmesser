import { describe, expect, it } from 'vitest';
import { parseExercise } from './fitness';
import { parseCapture } from './index';
import { splitCapture } from './split';
import type { ParseOptions } from './types';

/** Thursday, 2026-10-29, 10:00 (as the corpus). */
const now = new Date(2026, 9, 29, 10, 0);
const ON: ParseOptions['fitness'] = { meal: true, workout: true };
const parse = (text: string, fitness = ON) => parseCapture(text, { now, fitness });

describe('fitness captures', () => {
  it('reads a meal with the prefix, the number anywhere; today is left to the adapter', () => {
    for (const text of ['kcal 650 Döner', 'kcal Döner 650', 'kcal: Döner 650 kcal']) {
      const r = parse(text);
      expect(r).toMatchObject({ type: 'meal', forced: true, needsChoice: false });
      expect(r.fields).toEqual({ title: 'Döner', kcal: 650 });
    }
  });

  it('detects „650 kcal“ without a prefix and keeps a ToDo as the alternative', () => {
    const r = parse('Döner 650 kcal');
    expect(r).toMatchObject({ type: 'meal', forced: false, needsChoice: false });
    expect(r.fields).toEqual({ title: 'Döner', kcal: 650 });
    expect(r.alternatives.map((a) => a.type)).toEqual(['todo']);
  });

  it('takes a past day word, also before the prefix', () => {
    expect(parse('gestern kcal 400 Pizza').fields).toEqual({
      title: 'Pizza',
      kcal: 400,
      date: '2026-10-28',
    });
  });

  it('never guesses between two plain numbers', () => {
    expect(parse('kcal 2 Brötchen 300').type).not.toBe('meal');
    expect(parse('kcal 2 Brötchen 300 kcal').fields).toMatchObject({ kcal: 300 });
  });

  it('gives way to the general parser for times, days and one-letter prefixes', () => {
    expect(parse('Essen mit Anna Freitag 19 Uhr').type).toBe('event');
    expect(parse('Training morgen 18 Uhr').type).toBe('event');
    expect(parse('kcal 650 Döner 12:30').type).not.toBe('meal');
    expect(parse('t Döner 650 kcal').type).toBe('todo');
    expect(parse('n Kalorientabelle 2000 kcal Ziel').type).toBe('note');
    expect(parse('Training buchen').type).toBe('todo');
  });

  it('does nothing while Fitness (or only its meals) is off', () => {
    expect(parseCapture('Döner 650 kcal', { now }).type).toBe('todo');
    expect(parseCapture('training Bankdrücken 3×8 60', { now }).type).toBe('todo');
    expect(parse('kcal 650 Döner', { workout: true }).type).toBe('todo');
    expect(parse('training Bankdrücken 3×8 60', { meal: true }).type).toBe('todo');
  });

  it('leaves text without a kcal signal to the general parser', () => {
    expect(parse('Kalorien zählen anfangen').type).toBe('todo');
    expect(parse('kcal Döner').type).toBe('todo');
    expect(parse('k 15 Uhr Zahnarzt').type).toBe('event');
  });

  it('reads a training line with several exercises', () => {
    const r = parse('training Bankdrücken 3×8 60, Kniebeuge 4x6 72,5 kg und Laufen 30 Min');
    expect(r).toMatchObject({ type: 'workout', forced: true });
    expect(r.fields.exercises).toEqual([
      { name: 'Bankdrücken', sets: 3, reps: 8, weightKg: 60 },
      { name: 'Kniebeuge', sets: 4, reps: 6, weightKg: 72.5 },
      { name: 'Laufen', durationMin: 30 },
    ]);
    expect(r.fields.date).toBeUndefined();
    expect(parse('training Bankdrücken 3x8 60, 70, 80').fields.exercises).toEqual([
      { name: 'Bankdrücken', sets: 3, reps: 8, weightKg: 60 },
    ]);
  });

  it('reads single exercises in common spellings and drops values out of range', () => {
    expect(parseExercise('Bankdrücken 3 × 8 @ 60')).toEqual({
      name: 'Bankdrücken',
      sets: 3,
      reps: 8,
      weightKg: 60,
    });
    expect(parseExercise('Rudern 3x10 45kg')).toEqual({
      name: 'Rudern',
      sets: 3,
      reps: 10,
      weightKg: 45,
    });
    expect(parseExercise('Radfahren 1,5 h')).toEqual({ name: 'Radfahren', durationMin: 90 });
    expect(parseExercise('Wandern 30 h')).toEqual({ name: 'Wandern' });
    expect(parseExercise('Plank')).toEqual({ name: 'Plank' });
    expect(parseExercise('3x8')).toBeUndefined();
  });

  it('accepts the English prefix', () => {
    expect(parse('workout Squat 5x5 100').fields.exercises).toEqual([
      { name: 'Squat', sets: 5, reps: 5, weightKg: 100 },
    ]);
  });

  it('keeps a real training line whole when splitting, nothing else', () => {
    expect(splitCapture('training Bankdrücken 3×8 60, Kniebeuge 3×5 80')).toEqual([
      'training Bankdrücken 3×8 60, Kniebeuge 3×5 80',
    ]);
    expect(splitCapture('kcal 350 Haferflocken\nkcal 650 Döner')).toEqual([
      'kcal 350 Haferflocken',
      'kcal 650 Döner',
    ]);
  });
});
