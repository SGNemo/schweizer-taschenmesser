// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { clearErrorLog, errorLog, installErrorLog, recordError, sanitize } from './errorLog';

// A secret shorter than 24 characters is not caught by the "long token-like run" rule. When an error
// message names it (`password: …`, `Bearer …`, `?api_key=…`), the value must still never reach the log
// or its persisted copy in localStorage. Own file: `diagnostics.test.ts` is a protected guard.
const SHORT = 'hunter2Xy'; // 9 characters: far below the 24-character token rule
const PUNCT = 'P@ss!w0rd#26';

describe('scrub: labelled secret values of any length', () => {
  afterEach(() => clearErrorLog());

  it.each([
    `login failed: password=${SHORT}`,
    `login failed, password: ${PUNCT}`,
    `401 Authorization: Bearer ${SHORT}`,
    `Authorization: Basic ${SHORT}`,
    `bad request token=${SHORT}&x=1`,
    `config {"apiKey":"${PUNCT}"}`,
    `api_key = ${SHORT}`,
    `client_secret: ${SHORT}`,
    `Passwort: ${PUNCT}`,
    `PIN=${SHORT}`,
  ])('hides the value in %s', (text) => {
    const out = sanitize(text);
    expect(out).not.toContain(SHORT);
    expect(out).not.toContain(PUNCT);
    expect(out).toContain('[secret]');
  });

  it('keeps ordinary words that only resemble a label', () => {
    expect(sanitize('token refresh failed')).toBe('token refresh failed');
    expect(sanitize('password field is empty')).toBe('password field is empty');
    expect(sanitize('secret store unavailable: biometric off')).toBe(
      'secret store unavailable: biometric off',
    );
  });

  it('never persists a short secret from an error or a tagged console.error', () => {
    const target = new EventTarget();
    const fakeConsole = {
      error: (..._args: unknown[]) => undefined,
      warn: (..._args: unknown[]) => undefined,
    };
    const uninstall = installErrorLog(target as unknown as Window, fakeConsole);
    try {
      recordError('sync', new Error(`server said: token=${SHORT}`));
      fakeConsole.error('[ai] provider refused', `api_key: ${PUNCT}`);
      const stored = localStorage.getItem('tm-diag-errors') ?? '';
      expect(stored).not.toContain(SHORT);
      expect(stored).not.toContain(PUNCT);
      expect(JSON.stringify(errorLog())).not.toContain(SHORT);
    } finally {
      uninstall();
    }
  });
});
