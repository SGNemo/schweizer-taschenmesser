import { describe, expect, it } from 'vitest';
import { matchesOrigin, normalizeOrigin, originString, registrableDomain } from '../src/origin';

describe('normalizeOrigin', () => {
  it('adds https when the scheme is missing and drops default ports', () => {
    expect(normalizeOrigin('example.com')).toEqual({
      scheme: 'https',
      host: 'example.com',
      port: 443,
    });
    expect(normalizeOrigin('http://Example.COM:80/path?q=1')).toEqual({
      scheme: 'http',
      host: 'example.com',
      port: 80,
    });
  });
  it('keeps explicit ports, also without a scheme', () => {
    expect(normalizeOrigin('localhost:8443')).toEqual({
      scheme: 'https',
      host: 'localhost',
      port: 8443,
    });
    expect(originString(normalizeOrigin('https://a.example:8443')!)).toBe('https://a.example:8443');
    expect(originString(normalizeOrigin('https://a.example:443')!)).toBe('https://a.example');
  });
  it('converts IDN hosts to punycode and ignores a trailing dot', () => {
    expect(normalizeOrigin('https://bücher.example')?.host).toBe('xn--bcher-kva.example');
    expect(normalizeOrigin('https://example.com.')?.host).toBe('example.com');
  });
  it('rejects other schemes and garbage', () => {
    for (const bad of [
      '',
      'javascript:alert(1)',
      'file:///etc/passwd',
      'chrome://settings',
      'ftp://x.test',
      'http://',
    ]) {
      expect(normalizeOrigin(bad)).toBeNull();
    }
  });
});

describe('registrableDomain', () => {
  it('handles multi-label and private suffixes', () => {
    expect(registrableDomain('login.shop.example.co.uk')).toBe('example.co.uk');
    expect(registrableDomain('alice.github.io')).toBe('alice.github.io');
    expect(registrableDomain('localhost')).toBeNull();
    expect(registrableDomain('192.168.0.1')).toBeNull();
    expect(registrableDomain('[::1]')).toBeNull();
  });
});

describe('matchesOrigin', () => {
  it('matches the same origin and, in domain mode, subdomains', () => {
    expect(matchesOrigin('https://example.com', 'https://example.com')).toBe(true);
    expect(matchesOrigin('example.com', 'https://login.example.com')).toBe(true);
    expect(matchesOrigin('https://login.example.com', 'https://www.example.com')).toBe(true);
  });
  it('host mode needs the exact host', () => {
    expect(matchesOrigin('https://example.com', 'https://login.example.com', 'host')).toBe(false);
    expect(matchesOrigin('https://example.com', 'https://EXAMPLE.com/', 'host')).toBe(true);
  });
  it('never mixes http and https or different ports', () => {
    expect(matchesOrigin('https://example.com', 'http://example.com')).toBe(false);
    expect(matchesOrigin('http://example.com', 'https://example.com')).toBe(false);
    expect(matchesOrigin('https://example.com', 'https://example.com:8443')).toBe(false);
    expect(matchesOrigin('https://example.com:8443', 'https://example.com:8443')).toBe(true);
  });
  it.each([
    ['https://example.com', 'https://example.com.evil.test'],
    ['https://example.com', 'https://evil-example.com'],
    ['https://example.com', 'https://examp1e.com'],
    ['https://example.com', 'https://example.com@evil.test'],
    ['https://example.com', 'https://evil.test/https://example.com'],
    ['https://example.com', 'https://example.co'],
    ['https://example.co.uk', 'https://other.co.uk'],
    ['https://alice.github.io', 'https://mallory.github.io'],
  ])('does not offer %s on %s', (stored, page) => {
    expect(matchesOrigin(stored, page)).toBe(false);
    expect(matchesOrigin(stored, page, 'host')).toBe(false);
  });
  it('treats homograph hosts as different from the ASCII look-alike', () => {
    expect(matchesOrigin('https://apple.com', 'https://аpple.com')).toBe(false); // Cyrillic а
  });
  it('matches IP addresses and localhost only exactly', () => {
    expect(matchesOrigin('http://192.168.0.1', 'http://192.168.0.1')).toBe(true);
    expect(matchesOrigin('http://192.168.0.1', 'http://10.0.0.1')).toBe(false);
    expect(matchesOrigin('http://localhost:3000', 'http://localhost:3000')).toBe(true);
    expect(matchesOrigin('http://localhost:3000', 'http://app.localhost:3000')).toBe(false);
  });
  it('fails closed on unparsable input', () => {
    expect(matchesOrigin('', 'https://example.com')).toBe(false);
    expect(matchesOrigin('https://example.com', 'javascript:alert(1)')).toBe(false);
  });
});
