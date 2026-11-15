import { describe, expect, it } from 'vitest';
import { analyzeMessage, type MailMeta } from './heuristics';

// Invented mail. The day a finding reads dates against is the mail's local calendar day.
const mail = (dateMs: number): MailMeta => ({
  id: 'm1',
  from: 'Beispiel Dienste <service@example.test>',
  subject: 'Ihre Rechnung',
  snippet: 'Rechnungsbetrag 42,00 € fällig am 20.11.2026',
  dateMs,
  bulk: false,
});

describe('analyzeMessage: the mail day', () => {
  it('is the local day, also just after local midnight and just before the next', () => {
    for (const [h, m] of [
      [0, 30],
      [12, 0],
      [23, 45],
    ] as const) {
      const f = analyzeMessage(mail(new Date(2026, 10, 3, h, m).getTime()));
      expect(f?.mailDate).toBe('2026-11-03');
    }
  });

  it('an unreadable date yields no finding instead of throwing', () => {
    expect(() => analyzeMessage(mail(Number.NaN))).not.toThrow();
    expect(analyzeMessage(mail(Number.NaN))).toBeUndefined();
  });
});
