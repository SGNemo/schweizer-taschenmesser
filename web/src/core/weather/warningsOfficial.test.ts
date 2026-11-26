// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setNow } from '@/core/time/now';
import { clearCache } from './cache';
import {
  activeOfficial,
  displayEvent,
  kindOf,
  OFFICIAL_KEY,
  officialUrl,
  parseOfficial,
  readOfficial,
  refreshOfficial,
  withoutReplaced,
  type OfficialWarning,
} from './warningsOfficial';
import { KP_KEY } from '@/core/sky/aurora';

/**
 * Official DWD warnings (handoff/03b tests 2, 3, 5, 6). The fixtures have the shape the live GeoServer answered on
 * 2026-11-25 (`dwd:Warnungen_Gemeinden`, JSON, `propertyName` limited to the fields used); values hand-written.
 */
const f = (p: Record<string, string | null>) => ({ type: 'Feature', id: 'x', properties: p });
const base = {
  STATUS: 'Actual',
  MSGTYPE: 'Alert',
  URGENCY: 'Immediate',
  ONSET: '2026-11-25T15:00:00Z',
  EXPIRES: '2026-11-26T11:00:00Z',
};
const answer = (...features: unknown[]) => ({
  type: 'FeatureCollection',
  features,
  totalFeatures: features.length,
  numberMatched: features.length,
  numberReturned: features.length,
});

describe('parse', () => {
  it('levels 2–4 from the CAP severity; level 1, advance information, UV, tests and cancellations dropped', () => {
    const out = parseOfficial(
      answer(
        f({ ...base, EVENT: 'FROST', SEVERITY: 'Minor', EC_GROUP: 'FROST' }),
        f({ ...base, EVENT: 'STURMBÖEN', SEVERITY: 'Moderate', EC_GROUP: 'WIND' }),
        f({ ...base, EVENT: 'ORKANARTIGE BÖEN', SEVERITY: 'Severe', EC_GROUP: 'WIND' }),
        f({ ...base, EVENT: 'EXTREMES GEWITTER', SEVERITY: 'Extreme', EC_GROUP: 'THUNDERSTORM' }),
        f({
          ...base,
          EVENT: 'DAUERREGEN',
          SEVERITY: 'Moderate',
          URGENCY: 'Future',
          EC_GROUP: 'RAIN',
        }),
        f({ ...base, EVENT: 'UV-INDEX', SEVERITY: 'Moderate', EC_GROUP: 'UV' }),
        f({ ...base, EVENT: 'GLATTEIS', SEVERITY: 'Severe', STATUS: 'Test', EC_GROUP: 'GLAZE' }),
        f({ ...base, EVENT: 'HITZE', SEVERITY: 'Moderate', MSGTYPE: 'Cancel', EC_GROUP: 'HEAT' }),
        { properties: { EVENT: 1 } }, // foreign shape: ignored, not fatal
      ),
    )!;
    expect(out.map((w) => [w.event, w.level, w.kind])).toEqual([
      ['Sturmböen', 2, 'wind'],
      ['Orkanartige Böen', 3, 'wind'],
      ['Extremes Gewitter', 4, 'storm'],
    ]);
    expect(parseOfficial({ nope: true })).toBeUndefined();
    expect(parseOfficial(answer())).toEqual([]);
  });

  it("several warnings of one event: the one in force that ends last; tomorrow's does not hide today's", () => {
    const out = parseOfficial(
      answer(
        f({ ...base, EVENT: 'STURMBÖEN', SEVERITY: 'Moderate', EXPIRES: '2026-11-25T18:00:00Z' }),
        f({ ...base, EVENT: 'STURMBÖEN', SEVERITY: 'Moderate', EXPIRES: '2026-11-25T23:00:00Z' }),
        f({
          ...base,
          EVENT: 'STURMBÖEN',
          SEVERITY: 'Moderate',
          ONSET: '2026-11-26T10:00:00Z',
          EXPIRES: '2026-11-26T23:00:00Z',
        }),
      ),
    )!;
    expect(out).toHaveLength(3);
    const now = Date.parse('2026-11-25T16:00:00Z');
    const shown = activeOfficial(out, now, 'Europe/Berlin');
    expect(shown).toHaveLength(1);
    expect(new Date(shown[0]!.expires).toISOString()).toBe('2026-11-25T23:00:00.000Z');
  });

  it('the event in ordinary case and its hint kind', () => {
    expect(displayEvent('ORKANARTIGE BÖEN')).toBe('Orkanartige Böen');
    expect(displayEvent('STARKES GEWITTER mit HAGEL')).toBe('Starkes Gewitter mit Hagel');
    expect(displayEvent('FROST')).toBe('Frost');
    expect(kindOf('GEWITTER', 'THUNDERSTORM')).toBe('storm');
    expect(kindOf('STURMBÖEN', 'WIND')).toBe('wind');
    expect(kindOf('ORKANARTIGE BÖEN')).toBe('wind');
    expect(kindOf('DAUERREGEN', 'RAIN')).toBe('rain');
    expect(kindOf('STARKREGEN')).toBe('rain');
    expect(kindOf('HITZE', 'HEAT')).toBe('heat');
    expect(kindOf('STRENGER FROST', 'FROST')).toBe('frost');
    expect(kindOf('GLATTEIS', 'GLAZE')).toBe('ice');
    expect(kindOf('GEFRIERENDER REGEN')).toBe('ice');
    for (const e of ['SCHNEEFALL', 'NEBEL', 'TAUWETTER']) expect(kindOf(e)).toBeUndefined();
  });
});

const w = (o: Partial<OfficialWarning>): OfficialWarning => ({
  event: 'Sturmböen',
  level: 2,
  kind: 'wind',
  onset: Date.parse('2026-11-25T10:00:00Z'),
  expires: Date.parse('2026-11-25T20:00:00Z'),
  ...o,
});
const NOW = Date.parse('2026-11-25T12:00:00Z');

describe('which are shown', () => {
  it('in force now or beginning later today; not tomorrow, not expired; highest level, then earliest end', () => {
    const now1 = w({ event: 'A', level: 2, expires: Date.parse('2026-11-25T22:00:00Z') });
    const later = w({ event: 'B', level: 3, onset: Date.parse('2026-11-25T18:00:00Z') });
    const tomorrow = w({
      event: 'C',
      onset: Date.parse('2026-11-26T08:00:00Z'),
      expires: Date.parse('2026-11-26T20:00:00Z'),
    });
    const gone = w({ event: 'D', expires: Date.parse('2026-11-25T11:00:00Z') });
    const sooner = w({ event: 'E', level: 2, expires: Date.parse('2026-11-25T14:00:00Z') });
    expect(
      activeOfficial([now1, later, tomorrow, gone, sooner], NOW, 'Europe/Berlin').map(
        (x) => x.event,
      ),
    ).toEqual(['B', 'E', 'A']);
  });

  it('replace rule per kind: official wind today hides computed wind today, keeps rain today and wind tomorrow', () => {
    const computed = [
      { kind: 'wind', date: '2026-11-25' },
      { kind: 'rain', date: '2026-11-25' },
      { kind: 'wind', date: '2026-11-26' },
    ];
    expect(withoutReplaced(computed, [w({})], '2026-11-25')).toEqual([
      { kind: 'rain', date: '2026-11-25' },
      { kind: 'wind', date: '2026-11-26' },
    ]);
    // Official fog has no kind: hides nothing. No official answer: the computed stay.
    expect(
      withoutReplaced(computed, [w({ event: 'Nebel', kind: undefined })], '2026-11-25'),
    ).toEqual(computed);
    expect(withoutReplaced(computed, undefined, '2026-11-25')).toEqual(computed);
  });
});

describe('request and cache', () => {
  beforeEach(() => {
    localStorage.clear();
    setNow(() => NOW);
  });
  afterEach(() => {
    setNow();
    vi.unstubAllGlobals();
  });
  const ok = () =>
    vi.fn(
      async () =>
        new Response(
          JSON.stringify(
            answer(f({ ...base, EVENT: 'STURMBÖEN', SEVERITY: 'Moderate', EC_GROUP: 'WIND' })),
          ),
          { status: 200 },
        ),
    ) as unknown as typeof fetch & ReturnType<typeof vi.fn>;

  it('the URL carries only the rounded position of the main place and the fields used', () => {
    const u = new URL(officialUrl(47.66, 9.18));
    expect(u.host).toBe('maps.dwd.de');
    expect(u.searchParams.get('CQL_FILTER')).toBe('INTERSECTS(THE_GEOM,POINT(47.66 9.18))');
    expect(u.searchParams.get('propertyName')).toBe(
      'EVENT,SEVERITY,URGENCY,ONSET,EXPIRES,EC_GROUP,STATUS,MSGTYPE',
    );
    expect(u.searchParams.get('typeName')).toBe('dwd:Warnungen_Gemeinden');
  });

  it('asked in Germany with the switch on; not with it off, not outside Germany, not offline', async () => {
    const f1 = ok();
    await refreshOfficial(47.66, 9.18, false, f1);
    await refreshOfficial(47.38, 8.54, true, f1); // Zürich
    vi.stubGlobal('navigator', { onLine: false });
    await refreshOfficial(47.66, 9.18, true, f1);
    vi.unstubAllGlobals();
    expect(f1).not.toHaveBeenCalled();
    await refreshOfficial(47.66, 9.18, true, f1);
    expect(f1).toHaveBeenCalledTimes(1);
    expect(readOfficial(47.66, 9.18)!.map((x) => x.event)).toEqual(['Sturmböen']);
    // Within 30 minutes: not asked again.
    await refreshOfficial(47.66, 9.18, true, f1);
    expect(f1).toHaveBeenCalledTimes(1);
  });

  it('the 60-minute rule, another place, and clearCache (keeps the global Kp file)', async () => {
    await refreshOfficial(47.66, 9.18, true, ok());
    localStorage.setItem(KP_KEY, JSON.stringify({ at: NOW, steps: [] }));
    expect(readOfficial(47.66, 9.18, NOW + 59 * 60000)).toBeDefined();
    expect(readOfficial(47.66, 9.18, NOW + 61 * 60000)).toBeUndefined();
    expect(readOfficial(52.52, 13.4)).toBeUndefined();
    clearCache();
    expect(localStorage.getItem(OFFICIAL_KEY)).toBeNull();
    expect(localStorage.getItem(KP_KEY)).not.toBeNull();
  });

  it('a failing service is silent and not asked again for 5 minutes', async () => {
    const bad = vi.fn(async () => new Response('', { status: 503 })) as unknown as typeof fetch &
      ReturnType<typeof vi.fn>;
    await refreshOfficial(47.66, 9.18, true, bad);
    await refreshOfficial(47.66, 9.18, true, bad);
    expect(bad).toHaveBeenCalledTimes(1);
    expect(readOfficial(47.66, 9.18)).toBeUndefined();
  });
});
