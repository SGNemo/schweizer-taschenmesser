import { describe, expect, it } from 'vitest';
import { linkDecision } from '../linkCheck';

// M6 (launch review 2026-11): a mail link opened without showing where it really goes. A link whose
// visible text names another domain than its target is asked about, naming the real host.
describe('linkDecision', () => {
  it('opens a link whose text names the same site, or no site at all', () => {
    expect(linkDecision('Zum Konto', 'https://bank.example/login')).toEqual({
      open: 'https://bank.example/login',
    });
    expect(linkDecision('www.bank.example', 'https://login.bank.example/x')).toEqual({
      open: 'https://login.bank.example/x',
    });
    expect(linkDecision('https://bank.example/x', 'https://bank.example/x')).toEqual({
      open: 'https://bank.example/x',
    });
    expect(linkDecision('Anrufen', 'tel:+491234')).toEqual({ open: 'tel:+491234' });
  });

  it('asks when the text names another site than the target', () => {
    expect(linkDecision('www.bank.example', 'https://bank-example.evil.test/login')).toEqual({
      ask: 'https://bank-example.evil.test/login',
      host: 'bank-example.evil.test',
      shown: 'www.bank.example',
    });
    expect(
      linkDecision('Login: https://paypal.com/signin', 'http://paypal.com.evil.test/'),
    ).toMatchObject({
      host: 'paypal.com.evil.test',
    });
  });

  it('never opens anything but http(s), mailto and tel', () => {
    for (const href of ['javascript:alert(1)', 'file:///C:/x', 'data:text/html,x', '']) {
      expect(linkDecision('x', href)).toEqual({ none: true });
    }
  });
});
