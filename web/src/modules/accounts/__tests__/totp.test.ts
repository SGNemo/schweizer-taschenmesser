import { describe, expect, it } from 'vitest';
import { parseTotpInput, totpNow, totpUri } from '../totp';

const SECRETS = {
  SHA1: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
  SHA256: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA====',
  SHA512:
    'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNA=',
} as const;

/** RFC 6238, appendix B: 8-digit codes. */
const VECTORS: [number, string, string, string][] = [
  [59, '94287082', '46119246', '90693936'],
  [1111111109, '07081804', '68084774', '25091201'],
  [1111111111, '14050471', '67062674', '99943326'],
  [1234567890, '89005924', '91819424', '93441116'],
  [2000000000, '69279037', '90698825', '38618901'],
  [20000000000, '65353130', '77737706', '47863826'],
];

describe('TOTP (RFC 6238 test vectors)', () => {
  it.each(VECTORS)('t = %i', (seconds, sha1, sha256, sha512) => {
    for (const [algorithm, expected] of [
      ['SHA1', sha1],
      ['SHA256', sha256],
      ['SHA512', sha512],
    ] as const) {
      const { code } = totpNow(
        { secret: SECRETS[algorithm], issuer: '', digits: 8, period: 30, algorithm },
        seconds * 1000,
      );
      expect(code, algorithm).toBe(expected);
    }
  });

  it('reports the seconds left in the current step', () => {
    const cfg = {
      secret: SECRETS.SHA1,
      issuer: '',
      digits: 6 as const,
      period: 30,
      algorithm: 'SHA1' as const,
    };
    expect(totpNow(cfg, 59_000).secondsLeft).toBe(1);
    expect(totpNow(cfg, 60_000).secondsLeft).toBe(30);
    expect(totpNow(cfg, 60_000).code).toHaveLength(6);
  });

  it('uses the injectable clock by default', async () => {
    const { setNow } = await import('@/core/time/now');
    setNow(() => 59_000);
    try {
      const cfg = {
        secret: SECRETS.SHA1,
        issuer: '',
        digits: 8 as const,
        period: 30,
        algorithm: 'SHA1' as const,
      };
      expect(totpNow(cfg).code).toBe('94287082');
    } finally {
      setNow();
    }
  });
});

describe('TOTP input', () => {
  it('accepts a bare secret with spaces/lower case', () => {
    expect(parseTotpInput('gezd gnbv gy3t qojq gezd gnbv gy3t qojq')).toMatchObject({
      secret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
      digits: 6,
      period: 30,
      algorithm: 'SHA1',
    });
  });

  it('parses an otpauth URI including parameters', () => {
    const cfg = parseTotpInput(
      'otpauth://totp/Example:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example&digits=8&period=60&algorithm=SHA256',
    );
    expect(cfg).toMatchObject({
      secret: 'JBSWY3DPEHPK3PXP',
      issuer: 'Example',
      digits: 8,
      period: 60,
      algorithm: 'SHA256',
    });
  });

  it('rejects garbage, HOTP links and too short secrets', () => {
    expect(parseTotpInput('')).toBeUndefined();
    expect(parseTotpInput('not base32 !!!')).toBeUndefined();
    expect(parseTotpInput('ABCD')).toBeUndefined();
    expect(parseTotpInput('otpauth://hotp/x?secret=JBSWY3DPEHPK3PXP&counter=1')).toBeUndefined();
  });

  it('exports and re-imports an otpauth URI', () => {
    const cfg = parseTotpInput('JBSWY3DPEHPK3PXP')!;
    const uri = totpUri(cfg, 'GitHub');
    expect(uri.startsWith('otpauth://totp/')).toBe(true);
    expect(parseTotpInput(uri)).toMatchObject({ secret: 'JBSWY3DPEHPK3PXP' });
  });
});
