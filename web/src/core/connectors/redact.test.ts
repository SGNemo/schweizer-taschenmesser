import { describe, expect, it } from 'vitest';
import { redact, redactWith } from './redact';

describe('redact', () => {
  it('removes Google tokens and secrets wherever they appear', () => {
    const text =
      'GET https://x/y?access_token=ya29.a0AfB_byC-1234567890abcdef&foo=1 failed: Bearer ya29.zzzzzzzzzzzz refresh 1//0gAbCdEfGhIjKlMnOpQrStUv secret GOCSPX-abc_DEF-123';
    const out = redact(text);
    expect(out).not.toMatch(/ya29|1\/\/0g|GOCSPX-abc|AfB_byC/);
    expect(out).toContain('foo=1');
  });

  it('removes JSON-style and form-style secrets', () => {
    expect(redact('{"refresh_token":"abc123def456","expires_in":3599}')).not.toContain(
      'abc123def456',
    );
    expect(redact('client_secret=topsecretvalue&grant_type=refresh_token')).toBe(
      'client_secret=[redacted]&grant_type=refresh_token',
    );
    expect(redact('code=4/0AbCdEf&state=xyz')).not.toContain('4/0AbCdEf');
  });

  it('hides the secret part of iCal addresses', () => {
    const url =
      'https://calendar.google.com/calendar/ical/me%40example.com/private-0123456789abcdef0123456789abcdef/basic.ics';
    const out = redact(url);
    expect(out).not.toContain('0123456789abcdef0123456789abcdef');
    expect(out).toContain('basic.ics');
  });

  it('leaves ordinary text alone', () => {
    const text = 'Der Server antwortete mit 503 (Service Unavailable).';
    expect(redact(text)).toBe(text);
  });

  it('removes literal values the user configured', () => {
    expect(
      redactWith('bad client my-client-id-123.apps', ['my-client-id-123', undefined, 'x']),
    ).toBe('bad client [redacted].apps');
  });
});
