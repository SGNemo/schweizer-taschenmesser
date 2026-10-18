import { describe, expect, it } from 'vitest';
import { minutesUntil, nextToday, untilLabel } from './until';

describe('time until the next appointment', () => {
  it('computes minutes between two local times', () => {
    expect(minutesUntil('10:00', '13:00')).toBe(180);
    expect(minutesUntil('10:40', '13:00')).toBe(140);
    expect(minutesUntil('13:00', '13:00')).toBe(0);
    expect(minutesUntil('14:00', '13:00')).toBe(-60);
  });

  it('labels it for people', () => {
    expect(untilLabel(0)).toBe('jetzt');
    expect(untilLabel(-5)).toBe('jetzt');
    expect(untilLabel(1)).toBe('in 1 Min');
    expect(untilLabel(45)).toBe('in 45 Min');
    expect(untilLabel(60)).toBe('in 1 Std');
    expect(untilLabel(80)).toBe('in 1 Std 20');
    expect(untilLabel(185)).toBe('in 3 Std 5');
  });

  it('picks the first open timed item after now', () => {
    const items = [
      { title: 'Ganztägig', allDay: true, kind: 'event' },
      { title: 'Vorbei', time: '08:00', allDay: false, kind: 'event' },
      { title: 'Später', time: '15:30', allDay: false, kind: 'event' },
      { title: 'Friseur', time: '13:00', allDay: false, kind: 'event' },
      { title: 'Erledigt', time: '11:00', allDay: false, kind: 'reminder', done: true },
    ];
    expect(nextToday(items, '10:00')?.title).toBe('Friseur');
    expect(nextToday(items, '14:00')?.title).toBe('Später');
    expect(nextToday(items, '16:00')).toBeUndefined();
  });
});
