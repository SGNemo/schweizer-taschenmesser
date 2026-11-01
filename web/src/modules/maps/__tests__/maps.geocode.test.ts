import { describe, expect, it, vi } from 'vitest';
import { MapsError, bboxOf, searchPlaces } from '../geocode';

const ok = (body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
const urlOf = (f: typeof fetch) =>
  String((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0]);

describe('searchPlaces', () => {
  it('asks nothing for fewer than two letters', async () => {
    const f = ok([]);
    expect(await searchPlaces(' a ', { lang: 'de', fetch: f })).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });

  it('coordinates need no service at all', async () => {
    const f = ok([]);
    const hits = await searchPlaces('49,5981; 11,0044', { lang: 'de', fetch: f });
    expect(hits).toEqual([{ label: '49.5981, 11.0044', lat: 49.5981, lon: 11.0044 }]);
    expect(f).not.toHaveBeenCalled();
  });

  it('sends only the words and the language, and rounds the answer', async () => {
    const f = ok([
      { display_name: 'Schlossplatz, Erlangen, Bayern', lat: '49.598123456', lon: '11.004456789' },
      { display_name: 'Kaputt', lat: 'x', lon: '1' },
      { display_name: 'Weit weg', lat: '95', lon: '1' },
    ]);
    const hits = await searchPlaces('Schlossplatz Erlangen', { lang: 'fr', fetch: f });
    const url = urlOf(f);
    expect(url).toContain('https://nominatim.openstreetmap.org/search?');
    expect(url).toContain('q=Schlossplatz+Erlangen');
    expect(url).toContain('accept-language=fr');
    expect([...new URL(url).searchParams.keys()].sort()).toEqual([
      'accept-language',
      'format',
      'limit',
      'q',
    ]);
    expect(hits).toEqual([
      { label: 'Schlossplatz, Erlangen, Bayern', lat: 49.59812, lon: 11.00446 },
    ]);
  });

  it('works with a service of your own, with or without a query string', async () => {
    const a = ok([]);
    await searchPlaces('Bern', { lang: 'de', fetch: a, baseUrl: 'https://geo.example/search' });
    expect(urlOf(a)).toMatch(/^https:\/\/geo\.example\/search\?q=Bern/);
    const b = ok([]);
    await searchPlaces('Bern', { lang: 'de', fetch: b, baseUrl: 'https://geo.example/s?key=1' });
    expect(urlOf(b)).toMatch(/^https:\/\/geo\.example\/s\?key=1&q=Bern/);
  });

  it('turns every failure into a MapsError', async () => {
    const down = vi.fn(async () => {
      throw new TypeError('offline');
    }) as unknown as typeof fetch;
    await expect(searchPlaces('Bern', { lang: 'de', fetch: down })).rejects.toBeInstanceOf(
      MapsError,
    );
    const bad = vi.fn(async () => new Response('x', { status: 500 })) as unknown as typeof fetch;
    await expect(searchPlaces('Bern', { lang: 'de', fetch: bad })).rejects.toBeInstanceOf(
      MapsError,
    );
    await expect(
      searchPlaces('Bern', { lang: 'de', fetch: ok({ nope: 1 }) }),
    ).rejects.toBeInstanceOf(MapsError);
  });
});

describe('bboxOf', () => {
  it("reads Nominatim's south, north, west, east and rejects nonsense", () => {
    expect(bboxOf(['49.5', '49.7', '10.9', '11.1'])).toEqual({
      minLat: 49.5,
      maxLat: 49.7,
      minLon: 10.9,
      maxLon: 11.1,
    });
    expect(bboxOf([49.5, 49.7, 10.9, 11.1])).toBeDefined();
    expect(bboxOf(undefined)).toBeUndefined();
    expect(bboxOf(['49.7', '49.5', '10.9', '11.1'])).toBeUndefined();
    expect(bboxOf(['x', '49.5', '10.9', '11.1'])).toBeUndefined();
    expect(bboxOf(['-95', '49.5', '10.9', '11.1'])).toBeUndefined();
    expect(bboxOf(['49.5', '49.7', '10.9'])).toBeUndefined();
  });

  it('a hit carries its area when the service names one', async () => {
    const f = ok([
      {
        display_name: 'Erlangen, Bayern, Deutschland',
        lat: '49.5981',
        lon: '11.0044',
        boundingbox: ['49.55', '49.64', '10.93', '11.09'],
      },
      { display_name: 'Ohne', lat: '49.5', lon: '11.0' },
    ]);
    const hits = await searchPlaces('Erlangen', { lang: 'de', fetch: f });
    expect(hits[0]!.bbox).toEqual({ minLat: 49.55, maxLat: 49.64, minLon: 10.93, maxLon: 11.09 });
    expect(hits[1]!.bbox).toBeUndefined();
  });
});
