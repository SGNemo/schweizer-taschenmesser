import { describe, expect, it } from 'vitest';
import { findOld, findReused, OLD_AFTER_DAYS } from '../audit';
import { emergencyHtml } from '../components/EmergencySheet';

const e = (id: string, password: string, changedAt?: string) => ({
  id,
  data: { title: id, password, changedAt },
});

describe('password audit (local)', () => {
  it('groups entries that share a password and ignores empty ones', () => {
    const groups = findReused([e('a', 'x1'), e('b', 'x1'), e('c', 'y'), e('d', ''), e('f', '')]);
    expect(groups).toEqual([['a', 'b']]);
  });

  it('flags only passwords with a known date at or past the limit', () => {
    const entries = [
      e('old', 'p', '2025-01-01'),
      e('edge', 'p', '2025-11-03'),
      e('new', 'p', '2026-10-01'),
      e('unknown', 'p'),
      e('nopw', '', '2020-01-01'),
    ];
    expect(OLD_AFTER_DAYS).toBe(365);
    expect(findOld(entries, '2026-11-03')).toEqual(['old', 'edge']);
  });
});

describe('emergency sheet', () => {
  it('holds static steps, the date and a count, and escapes everything', () => {
    const html = emergencyHtml(7, '2026-11-03');
    expect(html).toContain('2026-11-03');
    expect(html).toContain('7');
    expect(html).not.toMatch(/<script/i);
  });
});
