import { describe, expect, it } from 'vitest';
import {
  analyzeMessage,
  dedupeFindings,
  findAmount,
  findDates,
  senderName,
  type MailMeta,
} from './heuristics';

// All mails are invented. Mail date: Tuesday 2026-09-29.
const MAIL_DATE = Date.UTC(2026, 8, 29, 8, 0);
const mail = (o: Partial<MailMeta>): MailMeta => ({
  id: 'm1',
  from: 'Beispiel Dienste <service@example.test>',
  subject: '',
  snippet: '',
  dateMs: MAIL_DATE,
  bulk: false,
  ...o,
});

describe('findAmount', () => {
  it('reads German amounts with either currency position and prefers the total', () => {
    expect(findAmount('Positionen 5,00 € · Gesamtbetrag: 1.234,56 EUR')).toBe(123456);
    expect(findAmount('Summe € 19,90')).toBe(1990);
    expect(findAmount('Versand 3,00 € Gesamt 12,50 €')).toBe(1250);
    expect(findAmount('ohne Betrag')).toBeUndefined();
    expect(findAmount('Preis 0,00 €')).toBeUndefined();
  });
});

describe('findDates', () => {
  it('reads full, short, year-less, ISO and month-name dates', () => {
    const text = '15.10.2026, 1.11.26, 24.12., 2026-11-30 und 5. Januar 2027';
    expect(findDates(text, '2026-09-29').map((d) => d.date)).toEqual([
      '2026-10-15',
      '2026-11-01',
      '2026-12-24',
      '2026-11-30',
      '2027-01-05',
    ]);
  });

  it('rolls a year-less date into next year when it already passed', () => {
    expect(findDates('am 3.1.', '2026-09-29')[0]!.date).toBe('2027-01-03');
  });

  it('ignores impossible dates', () => {
    expect(findDates('31.02.2026 und 45.13.2026', '2026-09-29')).toEqual([]);
  });
});

describe('senderName', () => {
  it('extracts the display name', () => {
    expect(senderName('"Anna Muster" <anna@example.test>')).toBe('Anna Muster');
    expect(senderName('Stadtwerke <info@example.test>')).toBe('Stadtwerke');
    expect(senderName('info@example.test')).toBe('info@example.test');
  });
});

describe('analyzeMessage', () => {
  it('recognises an invoice with amount and due date', () => {
    const f = analyzeMessage(
      mail({
        from: 'Stadtwerke Muster <rechnung@example.test>',
        subject: 'Ihre Rechnung für September',
        snippet: 'Rechnungsbetrag 87,40 €, fällig am 15.10.2026. Bitte überweisen Sie den Betrag.',
      }),
    )!;
    expect(f).toMatchObject({
      kind: 'invoice',
      title: 'Stadtwerke Muster',
      amountMinor: 8740,
      date: '2026-10-15',
      ref: 'gmail:m1',
    });
    expect(f.url).toContain('m1');
  });

  it('recognises a subscription with rhythm and next charge', () => {
    const f = analyzeMessage(
      mail({
        from: 'Filmfreund <no-reply@example.test>',
        subject: 'Dein Abonnement verlängert sich',
        snippet: 'Ihr Abo kostet monatlich 9,99 € und verlängert sich am 03.10.2026.',
      }),
    )!;
    expect(f).toMatchObject({
      kind: 'subscription',
      amountMinor: 999,
      freq: 'monthly',
      date: '2026-10-03',
    });
    const yearly = analyzeMessage(
      mail({
        subject: 'Jahresabo Verlängerung',
        snippet: 'Jährliche Verlängerung Ihres Abonnements: 59,00 €',
      }),
    )!;
    expect(yearly.freq).toBe('yearly');
  });

  it('recognises an appointment or ticket with date, time and place', () => {
    const f = analyzeMessage(
      mail({
        from: 'Kartenservice <tickets@example.test>',
        subject: 'Ihre Buchungsbestätigung: Konzert Beispielband',
        snippet: 'Am 21.11.2026 um 19:30 Uhr. Ort: Stadthalle Musterstadt. Ihre Tickets im Anhang.',
      }),
    )!;
    expect(f).toMatchObject({
      kind: 'event',
      title: 'Ihre Buchungsbestätigung: Konzert Beispielband',
      date: '2026-11-21',
      time: '19:30',
      place: 'Stadthalle Musterstadt',
    });
  });

  it('recognises a contract mail with notice period and end', () => {
    const f = analyzeMessage(
      mail({
        from: 'Versicherung Muster <post@example.test>',
        subject: 'Ihre Vertragsbestätigung',
        snippet: 'Vertragsende: 31.12.2027. Kündigungsfrist: 3 Monate. Beitrag 12,50 € monatlich.',
      }),
    )!;
    expect(f).toMatchObject({
      kind: 'contract',
      date: '2027-12-31',
      noticeDays: 90,
      amountMinor: 1250,
    });
  });

  it('ignores newsletters, plain conversation and events in the past', () => {
    expect(
      analyzeMessage(
        mail({
          bulk: true,
          subject: 'Unser Abo-Angebot',
          snippet: 'Jetzt für nur 4,99 € im Monat',
        }),
      ),
    ).toBeUndefined();
    expect(
      analyzeMessage(mail({ subject: 'Bis morgen!', snippet: 'Wir sehen uns beim Essen.' })),
    ).toBeUndefined();
    expect(
      analyzeMessage(
        mail({
          subject: 'Terminbestätigung',
          snippet: 'Ihr Termin war am 01.03.2026 um 10:00 Uhr.',
        }),
      ),
    ).toBeUndefined();
  });

  it('still reports a bill that arrives as a newsletter-style mail', () => {
    expect(
      analyzeMessage(
        mail({
          bulk: true,
          subject: 'Rechnung 2026-77',
          snippet: 'Betrag 20,00 €, fällig am 20.10.2026',
        }),
      ),
    ).toMatchObject({ kind: 'invoice', amountMinor: 2000 });
  });

  it('needs an amount or due date for an invoice', () => {
    expect(
      analyzeMessage(mail({ subject: 'Rechnung', snippet: 'Vielen Dank für Ihren Einkauf.' })),
    ).toBeUndefined();
  });
});

describe('dedupeFindings', () => {
  it('keeps the newest of repeated monthly mails but all different events', () => {
    const base = { kind: 'invoice' as const, title: 'Stadtwerke', amountMinor: 8740, url: 'u' };
    const out = dedupeFindings([
      { ...base, ref: 'a', mailDate: '2026-07-01' },
      { ...base, ref: 'b', mailDate: '2026-09-01' },
      { ...base, ref: 'c', mailDate: '2026-08-01' },
      { kind: 'event', title: 'Konzert', ref: 'd', mailDate: '2026-09-01', date: '2026-11-21' },
      { kind: 'event', title: 'Konzert', ref: 'e', mailDate: '2026-09-02', date: '2026-12-21' },
    ]);
    expect(out.map((f) => f.ref)).toEqual(['e', 'b', 'd']);
  });
});
