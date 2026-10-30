import { describe, expect, it } from 'vitest';
import { recentSlots } from '../recentSlots';

const ev = (title: string, startTime: string, endTime: string, createdAt: number, kind = 'event') =>
  ({ title, kind, startTime, endTime, createdAt }) as const;

describe('recentSlots', () => {
  it('lists each title/start/end once, newest first, skipping reminders and open ends', () => {
    const slots = recentSlots([
      ev('Frühdienst', '06:00', '14:30', 1),
      ev('Spätdienst', '14:00', '22:30', 2),
      ev('Frühdienst', '06:00', '14:30', 3),
      ev('Pille', '08:00', '08:05', 4, 'reminder'),
      { title: 'Arzt', kind: 'event', startTime: '10:00', createdAt: 5 },
    ]);
    expect(slots.map((s) => s.title)).toEqual(['Frühdienst', 'Spätdienst']);
    expect(slots[0]).toEqual({ title: 'Frühdienst', startTime: '06:00', endTime: '14:30' });
  });

  it('caps the list', () => {
    const many = Array.from({ length: 9 }, (_, i) => ev(`S${i}`, '06:00', '07:00', i));
    expect(recentSlots(many)).toHaveLength(4);
  });
});
