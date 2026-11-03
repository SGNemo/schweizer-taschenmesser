import { describe, expect, it } from 'vitest';
import { movedSlot, resizedEnd, slotFromDrag, snap, toHhmm } from '../dragMath';

describe('drag maths', () => {
  it('snaps to quarter hours and formats the end of the day as 23:59', () => {
    expect(snap(7)).toBe(0);
    expect(snap(8)).toBe(15);
    expect(snap(52)).toBe(45);
    expect(toHhmm(1440)).toBe('23:59');
    expect(toHhmm(65)).toBe('01:05');
  });

  it('moves an event and keeps its length', () => {
    expect(movedSlot('2026-11-03', '10:00', '11:30', 62, 0)).toEqual({
      date: '2026-11-03',
      startTime: '11:00',
      endTime: '12:30',
    });
    expect(movedSlot('2026-11-03', '10:00', '11:30', 0, 2).date).toBe('2026-11-05');
  });

  it('does not invent an end time and stays inside the day', () => {
    expect(movedSlot('2026-11-03', '10:00', undefined, 30, 0)).toEqual({
      date: '2026-11-03',
      startTime: '10:30',
    });
    expect(movedSlot('2026-11-03', '22:30', '23:30', 600, 0)).toMatchObject({
      startTime: '22:59',
      endTime: '23:59',
    });
    expect(movedSlot('2026-11-03', '01:00', '02:00', -600, 0).startTime).toBe('00:00');
  });

  it('resizes the end but never above the start plus a quarter hour', () => {
    expect(resizedEnd('10:00', '11:00', 30)).toBe('11:30');
    expect(resizedEnd('10:00', '11:00', -120)).toBe('10:15');
    expect(resizedEnd('10:00', undefined, 30)).toBe('11:30');
    expect(resizedEnd('22:00', '23:00', 600)).toBe('23:59');
  });

  it('draws a slot by dragging; a click draws nothing', () => {
    expect(slotFromDrag(603, 600)).toBeNull();
    expect(slotFromDrag(605, 700)).toEqual({ startTime: '10:00', endTime: '11:45' });
    expect(slotFromDrag(700, 605)).toEqual({ startTime: '10:00', endTime: '11:45' });
  });
});
