// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseCapture } from '@/quickCapture/parser';
import { analyzeMessage, findDue, findReference, relativeDue } from './heuristics';
import { mailPrefill } from './prefill';

/**
 * German letter mails (lawyers, authorities, craftsmen) as the capture sheet reads them. Every name,
 * office, number and amount here is invented.
 */
const MAIL_DAY = new Date(2026, 10, 10, 9, 30).getTime(); // Tue 10.11.2026
const TODAY = '2026-11-16';
const NOW = new Date(2026, 10, 16, 10, 0);
const from = { name: 'Kanzlei Beispiel & Partner', email: 'post@kanzlei.example.org' };
const opening =
  'Sehr geehrte Frau Muster, in obiger Angelegenheit zeigen wir an, dass wir die Beispiel Wohnbau GmbH vertreten. ' +
  'Eine auf uns lautende Vollmacht liegt vor. ';

const read = (text: string) => parseCapture(text, { now: NOW }).fields;
const prefill = (subject: string, text: string) =>
  mailPrefill('invoice', { id: 'm', from, subject, date: MAIL_DAY, text }, { today: TODAY });

describe('letter mails: amount, due day and reference', () => {
  const corpus: { name: string; subject: string; text: string; amount: number; due: string }[] = [
    {
      name: '„EUR 186,40“ and „bis zum 03.12.2026“, no word „Rechnung“',
      subject: 'Ihr Zeichen AB-77 – Forderung Beispiel Wohnbau GmbH',
      text: `${opening}Wir fordern Sie auf, den Gesamtbetrag von EUR 186,40 bis zum 03.12.2026 auf unser Konto zu überweisen.`,
      amount: 18640,
      due: '2026-12-03',
    },
    {
      name: '„186,40 €“ and „innerhalb von 14 Tagen“',
      subject: 'Kostennote 2026/0815',
      text: `${opening}Anbei unsere Kostennote. Bitte überweisen Sie 186,40 € innerhalb von 14 Tagen.`,
      amount: 18640,
      due: '2026-11-24',
    },
    {
      name: '„binnen zwei Wochen“',
      subject: 'Zahlungsaufforderung',
      text: 'Wir bitten Sie, den offenen Betrag von 57,10 EUR binnen zwei Wochen zu begleichen.',
      amount: 5710,
      due: '2026-11-24',
    },
    {
      name: 'the amount after a long opening (more than 1500 characters)',
      subject: 'Ihr Zeichen 12/26',
      text: `${opening.repeat(14)}Zu zahlen ist ein Betrag von EUR 1.204,99, zahlbar bis 01.12.2026.`,
      amount: 120499,
      due: '2026-12-01',
    },
  ];

  for (const c of corpus) {
    it(c.name, () => {
      const p = prefill(c.subject, c.text);
      const f = read(p.text);
      expect(f.amountMinor).toBe(c.amount);
      expect(f.date).toBe(c.due);
      expect(f.title).toContain('Kanzlei Beispiel');
    });
  }

  it('the reference to quote goes along with the invoice', () => {
    expect(prefill('Rechnung', 'Rechnungsnummer: R-2026-117. Betrag 12,00 €').extra.reference).toBe(
      'R-2026-117',
    );
    expect(findReference('Aktenzeichen 12/26 bitte angeben')).toBe('12/26');
    expect(findReference('Ihr Zeichen: AB-77.')).toBe('AB-77');
    expect(findReference('Guten Tag, anbei die Unterlagen.')).toBeUndefined();
    // Never a word in place of a number, never a piece of another word („Amazon“, „Magazine“).
    expect(findReference('Ihre Bestellung bei Beispielshop Amazon.de. Rechnungsnummer: R-1')).toBe(
      'R-1',
    );
    expect(findReference('Das Magazine für Sie')).toBeUndefined();
    expect(findReference('Bitte Kundennummer angeben')).toBeUndefined();
    expect(findReference('Rechnungsnummer und Betrag')).toBeUndefined();
    expect(findReference('Az.: 12/26')).toBe('12/26');
  });

  it('a payment reminder letter keeps its word, so the sheet looks for the open invoice', () => {
    const p = prefill(
      '2. Mahnung',
      'Trotz Erinnerung ist der Betrag von 64,00 € offen. Bitte zahlen Sie bis 30.11.2026.',
    );
    expect(p.text.startsWith('2. Mahnung')).toBe(true);
    expect(read(p.text)).toMatchObject({ amountMinor: 6400, date: '2026-11-30' });
  });

  it('nothing found stays the sender alone (the fields then ask)', () => {
    expect(prefill('Unterlagen', 'Anbei die gewünschten Unterlagen.').text).toBe(
      'Kanzlei Beispiel & Partner',
    );
  });
});

describe('relative and worded due days', () => {
  it.each([
    ['innerhalb von 14 Tagen', '2026-11-24'],
    ['innerhalb 30 Tagen', '2026-12-10'],
    ['binnen einer Woche', '2026-11-17'],
    ['innerhalb von 10 Werktagen', '2026-11-24'],
    ['within 7 days', '2026-11-17'],
  ])('%s', (text, due) => expect(relativeDue(text, '2026-11-10')).toBe(due));

  it('a date after „bis zum“ wins over a span', () => {
    expect(
      findDue('bitte bis zum 01.12.2026, spätestens innerhalb von 14 Tagen', '2026-11-10'),
    ).toBe('2026-12-01');
  });

  it('„Anforderung“ is no claim: a password mail stays no invoice', () => {
    expect(
      analyzeMessage({
        id: 'x',
        from: 'Dienst <no-reply@example.org>',
        subject: 'Ihre Passwort-Anforderung',
        snippet: 'Der Link gilt bis 12.11.2026.',
        dateMs: MAIL_DAY,
        bulk: false,
      }),
    ).toBeUndefined();
  });
});
