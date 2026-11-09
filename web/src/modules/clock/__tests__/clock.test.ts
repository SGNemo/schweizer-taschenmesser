import { describe, expect, it } from 'vitest';
import { validateManifest } from '@/core/modules/registry';
import { diffLabel, placeTime } from '../logic';
import manifest from '../manifest';
import { placeSchema } from '../schema';

/** Noon UTC on a day. */
const noonUtc = (date: string) => Date.parse(`${date}T12:00:00Z`);

describe('clock module', () => {
  it('has a valid manifest: preview, off by default', () => {
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.maturity).toBe('preview');
    expect(manifest.defaultEnabled).toBe(false);
  });

  it('keeps only real zones and a name', () => {
    expect(placeSchema.safeParse({ label: 'Mama', zone: 'Asia/Tokyo', order: 0 }).success).toBe(
      true,
    );
    expect(placeSchema.safeParse({ label: 'Mama', zone: 'Mars/Olympus', order: 0 }).success).toBe(
      false,
    );
    expect(placeSchema.safeParse({ label: '  ', zone: 'UTC', order: 0 }).success).toBe(false);
  });
});

describe('placeTime', () => {
  it('follows daylight saving time on both sides (fixture: two dates)', () => {
    // Winter: Tokyo is 8 h ahead of Berlin, New York 6 h behind.
    expect(placeTime(noonUtc('2026-01-15'), 'Asia/Tokyo', 'Europe/Berlin').diffMinutes).toBe(480);
    expect(placeTime(noonUtc('2026-01-15'), 'America/New_York', 'Europe/Berlin').diffMinutes).toBe(
      -360,
    );
    // The US switched on 8 March, Europe only on 29 March: for three weeks New York is 5 h behind.
    expect(placeTime(noonUtc('2026-03-10'), 'America/New_York', 'Europe/Berlin').diffMinutes).toBe(
      -300,
    );
    // Summer: Tokyo (no DST) is 7 h ahead.
    expect(placeTime(noonUtc('2026-07-01'), 'Asia/Tokyo', 'Europe/Berlin').diffMinutes).toBe(420);
  });

  it('says tomorrow, yesterday and night', () => {
    // 22:30 in Berlin (winter) = 06:30 next day in Tokyo, 16:30 the same day in New York.
    const late = Date.parse('2026-01-15T21:30:00Z');
    const tokyo = placeTime(late, 'Asia/Tokyo', 'Europe/Berlin');
    expect(tokyo).toMatchObject({ time: '06:30', date: '2026-01-16', dayDiff: 1, night: false });
    // 00:30 in Berlin = 18:30 the day before in New York.
    const early = Date.parse('2026-01-14T23:30:00Z');
    expect(placeTime(early, 'America/New_York', 'Europe/Berlin')).toMatchObject({
      time: '18:30',
      dayDiff: -1,
      night: false,
    });
    expect(placeTime(early, 'Asia/Tokyo', 'Europe/Berlin').night).toBe(false);
    expect(
      placeTime(Date.parse('2026-01-15T03:00:00Z'), 'Europe/Berlin', 'Europe/Berlin'),
    ).toMatchObject({ time: '04:00', dayDiff: 0, night: true, diffMinutes: 0 });
  });
});

describe('diffLabel', () => {
  it('writes whole and half hours, nothing for the same time', () => {
    expect(diffLabel(480)).toBe('+8 h');
    expect(diffLabel(-360)).toBe('−6 h');
    expect(diffLabel(270)).toBe('+4:30 h');
    expect(diffLabel(-30)).toBe('−0:30 h');
    expect(diffLabel(0)).toBeUndefined();
  });
});
