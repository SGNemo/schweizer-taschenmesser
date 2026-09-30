import { describe, expect, it } from 'vitest';
import { convertText, fromBase64, toBase64 } from './logic';

describe('base64 / url', () => {
  it('round-trips UTF-8', () => {
    const text = 'Grüße – 日本 😀';
    expect(fromBase64(toBase64(text))).toBe(text);
  });
  it('encodes known values', () => {
    expect(toBase64('hello')).toBe('aGVsbG8=');
    expect(fromBase64('aGVsbG8')).toBe('hello'); // unpadded
    expect(fromBase64('aGVs\nbG8=')).toBe('hello'); // whitespace
  });
  it('accepts the URL-safe alphabet', () => {
    expect(fromBase64('Pz8_')).toBe('???');
    expect(fromBase64('Pj4-')).toBe('>>>');
  });
  it('rejects invalid input', () => {
    expect(convertText('b64-dec', '***')).toBeUndefined();
    expect(convertText('b64-dec', '/w==')).toBeUndefined(); // invalid UTF-8 (0xFF)
    expect(convertText('url-dec', '%E0%A4%A')).toBeUndefined();
  });
  it('encodes and decodes URL components', () => {
    expect(convertText('url-enc', 'a b&c=ä')).toBe('a%20b%26c%3D%C3%A4');
    expect(convertText('url-dec', 'a%20b%26c')).toBe('a b&c');
  });
});
