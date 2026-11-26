import { describe, expect, it } from 'vitest';
import type { Forecast } from '@/core/weather/api';
import { tWeatherPage } from '@/strings.weatherPage';
import { rainSoon, soonChip, soonSentence } from './rainSoon';

const tp = tWeatherPage.get();
const base = (mm: number[], extra: Partial<Forecast> = {}): Forecast => ({
  temp: 10,
  group: 'cloudy',
  soon: { at: '2026-07-16T14:00', mm },
  ...extra,
});

describe('rainSoon: the five sentences (COPY §2) as a table', () => {
  const cases: [string, number[], string, string][] = [
    [
      'starts later, ends inside',
      [0, 0.2, 0.5, 0.5, 0, 0, 0, 0],
      'Regen ab 14:15, etwa 45 Minuten, zusammen etwa 1,2 mm',
      'Regen ab 14:15',
    ],
    [
      'starts later, goes on',
      [0, 0, 0, 0, 0.2, 0.4, 0.6, 0.7],
      'Regen ab 15:00, hält länger an',
      'Regen ab 15:00',
    ],
    [
      'raining, ends inside',
      [0.6, 0.5, 0.3, 0, 0, 0, 0, 0],
      'Regen noch bis etwa 14:45',
      'Regen bis etwa 14:45',
    ],
    [
      'raining, goes on',
      [0.4, 0.5, 0.6, 0.6, 0.5, 0.5, 0.4, 0.4],
      'Regen, hält in den nächsten zwei Stunden an',
      'Regen jetzt',
    ],
    [
      'one short burst',
      [0, 0, 0, 0.9, 0, 0, 0, 0],
      'Kurzer Schauer gegen 14:45',
      'Schauer gegen 14:45',
    ],
  ];
  it.each(cases)('%s', (_, mm, sentence, chip) => {
    const s = rainSoon(base(mm), '2026-07-16T14:05')!;
    expect(soonSentence(tp, s)).toBe(sentence);
    expect(soonChip(tp, s)).toBe(chip);
  });

  it('says "Schnee" when the hour it starts in snows', () => {
    const f = base([0, 0.2, 0.5, 0.5, 0, 0, 0, 0], {
      hours: [{ time: '2026-07-16T14:00', temp: 0, group: 'snow', rain: 80, snow: 0.6 }],
    });
    const s = rainSoon(f, '2026-07-16T14:05')!;
    expect(s.snow).toBe(true);
    expect(soonSentence(tp, s)).toBe('Schnee ab 14:15, etwa 45 Minuten, zusammen etwa 1,2 mm');
    expect(soonChip(tp, s)).toBe('Schnee ab 14:15');
    const all = rainSoon(
      { ...f, soon: { at: '2026-07-16T14:00', mm: [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3] } },
      '2026-07-16T14:05',
    )!;
    expect(soonSentence(tp, all)).toBe('Schnee, hält in den nächsten zwei Stunden an');
    expect(soonChip(tp, all)).toBe('Schnee jetzt');
  });

  it('is null without 15-minute values, when all is dry and when the window has passed', () => {
    expect(rainSoon({ temp: 1, group: 'clear' }, '2026-07-16T14:05')).toBeNull();
    expect(rainSoon(base([0, 0, 0, 0, 0, 0, 0, 0.05]), '2026-07-16T14:05')).toBeNull();
    expect(rainSoon(base([0.5, 0, 0, 0, 0, 0, 0, 0]), '2026-07-16T16:10')).toBeNull();
  });

  it('reads the amounts against the clock: quarter hours that passed drop out', () => {
    // Fetched at 14:00, read at 14:31: rain that was "later" is now.
    const s = rainSoon(base([0, 0, 0.3, 0.3, 0, 0, 0, 0]), '2026-07-16T14:31')!;
    expect(s.kind).toBe('nowEnds');
    expect(s.until).toBe('15:00');
    expect(s.bars).toEqual([0.3, 0.3, 0, 0, 0, 0]);
  });
});
