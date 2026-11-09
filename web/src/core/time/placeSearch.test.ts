import { describe, expect, it } from 'vitest';
import { CITIES } from './cities';
import {
  allZones,
  editDistance,
  normalizePlace,
  resolvePlace,
  searchPlaces,
  zoneCityName,
} from './placeSearch';
import { isKnownZone } from './zones';

describe('city table', () => {
  it('names only zones the platform knows, about 200 cities', () => {
    expect(CITIES.length).toBeGreaterThanOrEqual(200);
    for (const [zone, , en] of CITIES) {
      expect(isKnownZone(zone), zone).toBe(true);
      expect(en.trim(), zone).not.toBe('');
    }
  });

  it('lists every platform zone offline', () => {
    const zones = allZones();
    expect(zones).toContain('UTC');
    expect(zones).toContain('Asia/Tokyo');
    expect(zones.length).toBeGreaterThan(300);
  });
});

describe('normalizePlace', () => {
  it('drops accents, case and separators', () => {
    expect(normalizePlace('São_Paulo')).toBe('sao paulo');
    expect(normalizePlace('  Straßburg ')).toBe('strassburg');
    expect(normalizePlace('Mexiko-Stadt')).toBe('mexiko stadt');
    expect(zoneCityName('America/Argentina/Buenos_Aires')).toBe('Buenos Aires');
  });
});

describe('editDistance', () => {
  it('counts swaps as one and stops above the limit', () => {
    expect(editDistance('tokoi', 'tokio', 2)).toBe(1);
    expect(editDistance('muenchn', 'muenchen', 2)).toBe(1);
    expect(editDistance('abc', 'xyzxyz', 1)).toBe(2);
  });
});

describe('searchPlaces', () => {
  it('finds German and English names and shows the one of the UI language', () => {
    expect(searchPlaces('Tokio', 'de')[0]).toEqual({ zone: 'Asia/Tokyo', name: 'Tokio', score: 0 });
    expect(searchPlaces('tokyo', 'de')[0]!.name).toBe('Tokio');
    expect(searchPlaces('Munich', 'en')[0]).toMatchObject({
      zone: 'Europe/Berlin',
      name: 'Munich',
    });
    expect(searchPlaces('Peking', 'en')[0]).toMatchObject({
      zone: 'Asia/Shanghai',
      name: 'Beijing',
    });
  });

  it('tolerates typos and missing umlauts', () => {
    expect(searchPlaces('Tokoi', 'de')[0]!.zone).toBe('Asia/Tokyo');
    expect(searchPlaces('Muenchen', 'de')[0]!.name).toBe('München');
    expect(searchPlaces('Sidney', 'de')[0]!.zone).toBe('Australia/Sydney');
    expect(searchPlaces('Kapstat', 'de')[0]!.zone).toBe('Africa/Johannesburg');
  });

  it('finds zones by their IANA id and city part', () => {
    expect(searchPlaces('Asia/Kolkata', 'de')[0]!.zone).toBe('Asia/Kolkata');
    expect(searchPlaces('Ulaanbaatar', 'en')[0]!.zone).toBe('Asia/Ulaanbaatar');
    expect(searchPlaces('Pacific/Chatham', 'en')[0]!.zone).toBe('Pacific/Chatham');
  });

  it('puts prefixes before typos and stays empty for noise', () => {
    const hits = searchPlaces('San', 'de').map((h) => h.name);
    expect(hits.length).toBeGreaterThan(2);
    expect(normalizePlace(hits[0]!).startsWith('san')).toBe(true);
    expect(searchPlaces('', 'de')).toEqual([]);
    expect(searchPlaces('qqqqqqq', 'de')).toEqual([]);
  });
});

describe('resolvePlace', () => {
  it('takes a clear name, never a short or loose one', () => {
    expect(resolvePlace('Tokio', 'de')?.zone).toBe('Asia/Tokyo');
    expect(resolvePlace('new york', 'de')?.zone).toBe('America/New_York');
    expect(resolvePlace('to', 'de')).toBeUndefined();
    expect(resolvePlace('reparieren', 'de')).toBeUndefined();
  });
});
