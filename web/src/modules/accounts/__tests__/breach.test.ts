import { describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../settings';
import { BreachUnavailable, findBreached, findSuffix, sha1Hex, splitHash } from '../breach';

// SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
const PW = 'password';
const body = (rows: string[]) => new Response(rows.join('\r\n'));
const entry = (id: string, password: string) => ({ id, data: { password } });

describe('breach check', () => {
  it('is off by default (real settings, no mock)', () => {
    expect(defaultSettings.breachCheck).toBe(false);
  });

  it('hashes with SHA-1 (uppercase) and splits 5 / 35', async () => {
    const h = await sha1Hex(PW);
    expect(h).toBe('5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8');
    expect(splitHash(h)).toEqual({
      prefix: '5BAA6',
      suffix: '1E4C9B93F3F0682250B6CF8331B7EE68FD8',
    });
  });

  it('matches the suffix locally and ignores padding rows (count 0)', () => {
    const rows = 'AAAA:3\r\n1E4C9B93F3F0682250B6CF8331B7EE68FD8:9\r\nBBBB:0';
    expect(findSuffix(rows, '1E4C9B93F3F0682250B6CF8331B7EE68FD8')).toBe(true);
    expect(findSuffix(rows, 'AAAB')).toBe(false);
    expect(
      findSuffix('1E4C9B93F3F0682250B6CF8331B7EE68FD8:0', '1E4C9B93F3F0682250B6CF8331B7EE68FD8'),
    ).toBe(false);
  });

  it('sends only the prefix, with padding, and no entry data; one request per prefix', async () => {
    const f = vi.fn(async () => body(['1E4C9B93F3F0682250B6CF8331B7EE68FD8:5', 'FFFF:0']));
    const ids = await findBreached([entry('e1', PW), entry('e2', PW), entry('e3', 'zq9!Lm#x2w')], {
      fetch: f as unknown as typeof fetch,
    });
    expect(ids).toEqual(['e1', 'e2']);
    const urls = f.mock.calls.map((c) => String((c as unknown[])[0]));
    expect(urls[0]).toBe('https://api.pwnedpasswords.com/range/5BAA6');
    expect(urls).toHaveLength(2);
    for (const call of f.mock.calls as unknown as [string, RequestInit][]) {
      expect(call[0]).toMatch(/^https:\/\/api\.pwnedpasswords\.com\/range\/[0-9A-F]{5}$/);
      expect(call[1].headers).toEqual({ 'Add-Padding': 'true' });
      expect(call[1].body).toBeUndefined();
      expect(call[1].credentials).toBe('omit');
      expect(call[1].referrerPolicy).toBe('no-referrer');
    }
    expect(urls.join()).not.toContain('zq9');
  });

  it('network error or bad status becomes BreachUnavailable', async () => {
    await expect(
      findBreached([entry('e1', PW)], {
        fetch: (async () => {
          throw new TypeError('offline');
        }) as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(BreachUnavailable);
    await expect(
      findBreached([entry('e1', PW)], {
        fetch: (async () => new Response('', { status: 503 })) as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(BreachUnavailable);
  });

  it('entries without a password cause no request', async () => {
    const f = vi.fn();
    expect(await findBreached([entry('e1', '')], { fetch: f as unknown as typeof fetch })).toEqual(
      [],
    );
    expect(f).not.toHaveBeenCalled();
  });
});
