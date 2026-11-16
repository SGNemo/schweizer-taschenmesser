import { describe, expect, it } from 'vitest';
import {
  bodyOf,
  expired,
  fits,
  hostOf,
  kindOf,
  newItemId,
  openable,
  problemOf,
  RETENTION_MS,
} from '../logic';

describe('exchange logic', () => {
  it('a plain http(s) address is a link, everything else text', () => {
    expect(kindOf('https://example.org/rezept')).toBe('link');
    expect(kindOf('  http://192.168.1.10:8080/x \n')).toBe('link');
    expect(kindOf('https://example.org und mehr')).toBe('text');
    expect(kindOf('javascript:alert(1)')).toBe('text');
    expect(kindOf('https://bank.example@evil.example')).toBe('text');
    expect(kindOf('Vergiss nicht, Milch zu kaufen')).toBe('text');
    expect(bodyOf('  https://example.org \n', 'link')).toBe('https://example.org');
    expect(bodyOf('Zeile 1\nZeile 2\n\n', 'text')).toBe('Zeile 1\nZeile 2');
  });

  it('opens only http(s) links and shows their host', () => {
    expect(openable({ kind: 'link', body: 'https://example.org' })).toBe(true);
    expect(openable({ kind: 'text', body: 'https://example.org' })).toBe(false);
    expect(openable({ kind: 'link', body: 'file:///C:/x' })).toBe(false);
    expect(hostOf('https://example.org/a?b')).toBe('example.org');
  });

  it('ids are 32 hex digits', () => {
    expect(newItemId()).toMatch(/^[0-9a-f]{32}$/);
    expect(newItemId()).not.toBe(newItemId());
  });

  it('cards go after 30 days', () => {
    expect(expired(0, RETENTION_MS + 1)).toBe(true);
    expect(expired(0, RETENTION_MS)).toBe(false);
  });

  it('turns refusal codes into calm problems', () => {
    expect(problemOf('limit:12')).toEqual({ problem: 'limit', minutes: 12 });
    expect(problemOf('limit')).toEqual({ problem: 'limit', minutes: undefined });
    expect(problemOf('exchange-off')).toEqual({ problem: 'exchangeOff' });
    expect(problemOf('not-paired')).toEqual({ problem: 'notPaired' });
    expect(problemOf('unknown-device')).toEqual({ problem: 'unreachable' });
    expect(problemOf(null)).toBeNull();
  });
  it('follows the shell: bidi, zero-width and odd hosts are text, control characters go', () => {
    expect(kindOf('https://exa\u202Emple.org')).toBe('text');
    expect(kindOf('https://exa\u200Bmple.org')).toBe('text');
    expect(kindOf('http://-x.org')).toBe('text');
    expect(kindOf('http://[::1]:8080/a')).toBe('link');
    expect(kindOf('https://über.example/ä')).toBe('link');
    expect(bodyOf('a\u0007b\r\nc\td  ', 'text')).toBe('ab\nc\td');
  });

  it('counts the size in bytes as the shell does', () => {
    expect(fits('x'.repeat(16_384))).toBe(true);
    expect(fits('ä'.repeat(8_193))).toBe(false);
    expect(fits('   ')).toBe(false);
  });

  it('takes the minutes of a closed session from the event', () => {
    expect(problemOf('limit', 12)).toEqual({ problem: 'limit', minutes: 12 });
  });
});
