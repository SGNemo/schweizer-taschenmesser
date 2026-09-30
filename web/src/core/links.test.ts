import { describe, expect, it } from 'vitest';
import { mapsUrl, whatsappUrl } from './links';

describe('links', () => {
  it('encodes the place for the Maps search URL', () => {
    expect(mapsUrl(' Musterstraße 1, 12345 Beispielstadt ')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Musterstra%C3%9Fe%201%2C%2012345%20Beispielstadt',
    );
  });
  it('cannot be tricked into another parameter or host', () => {
    const url = new URL(mapsUrl('a&b=c#x'));
    expect(url.host).toBe('www.google.com');
    expect(url.searchParams.get('query')).toBe('a&b=c#x');
    expect(url.hash).toBe('');
  });
  it('builds a wa.me link with the encoded text and no phone number', () => {
    const url = new URL(whatsappUrl('Alles Gute, Anna! 🎂'));
    expect(url.origin + url.pathname).toBe('https://wa.me/');
    expect(url.searchParams.get('text')).toBe('Alles Gute, Anna! 🎂');
  });
});
