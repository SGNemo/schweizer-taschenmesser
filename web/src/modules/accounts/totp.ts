/** One-time codes (RFC 6238) with `otpauth`. The clock is `core/time/now`, never `Date.now()`. */
import * as OTPAuth from 'otpauth';
import { now } from '@/core/time/now';
import { totpSchema, type TotpConfig } from './schema';

const clean = (secret: string) => secret.replace(/[\s-]/g, '').toUpperCase();

function build(config: TotpConfig): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: config.issuer || undefined,
    algorithm: config.algorithm,
    digits: config.digits,
    period: config.period,
    secret: OTPAuth.Secret.fromBase32(clean(config.secret)),
  });
}

export function isValidSecret(secret: string): boolean {
  try {
    return OTPAuth.Secret.fromBase32(clean(secret)).bytes.length >= 10;
  } catch {
    return false;
  }
}

export interface TotpCode {
  code: string;
  /** Seconds until the code changes. */
  secondsLeft: number;
  period: number;
}

export function totpNow(config: TotpConfig, at: number = now()): TotpCode {
  const totp = build(config);
  return {
    code: totp.generate({ timestamp: at }),
    secondsLeft: Math.ceil(OTPAuth.TOTP.remaining({ period: config.period, timestamp: at }) / 1000),
    period: config.period,
  };
}

/** Accepts a bare Base32 secret or an `otpauth://totp/…` URI (as shown under QR codes). */
export function parseTotpInput(input: string): TotpConfig | undefined {
  const text = input.trim();
  if (!text) return undefined;
  try {
    if (text.toLowerCase().startsWith('otpauth://')) {
      const parsed = OTPAuth.URI.parse(text);
      if (!(parsed instanceof OTPAuth.TOTP)) return undefined;
      return totpSchema.parse({
        secret: parsed.secret.base32,
        issuer: parsed.issuer,
        digits: parsed.digits,
        period: parsed.period,
        algorithm: parsed.algorithm,
      });
    }
    if (!isValidSecret(text)) return undefined;
    return totpSchema.parse({ secret: clean(text) });
  } catch {
    return undefined;
  }
}

/** For export: the standard `otpauth://` URI. */
export function totpUri(config: TotpConfig, label: string): string {
  const totp = build(config);
  totp.label = label;
  return totp.toString();
}
