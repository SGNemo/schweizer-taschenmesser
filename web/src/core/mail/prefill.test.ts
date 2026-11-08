// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseCapture } from '@/quickCapture/parser';
import { MAIL_LINK_TYPES, mailPrefill, mailText } from './prefill';
import { mailWebUrl } from './service';

const TODAY = '2026-10-29';
const NOW = new Date(2026, 9, 29, 10, 0);
const link = 'https://mail.google.com/mail/?authuser=me%40example.org#all/t1';

const invoiceMail = {
  id: 'm1',
  from: { name: 'Stadtwerke Musterstadt', email: 'rechnung@stadtwerke.example.org' },
  subject: 'Ihre Rechnung für Oktober',
  date: new Date(2026, 9, 28, 8, 15).getTime(),
  text: 'Guten Tag, Ihre Rechnung über 84,30 EUR ist fällig am 15.11. Bitte überweisen Sie den Betrag.',
};
const eventMail = {
  id: 'm2',
  from: { name: 'Hausverwaltung', email: 'info@hv.example.org' },
  subject: 'Termin Ablesung Heizung',
  date: new Date(2026, 9, 28, 9, 0).getTime(),
  text: 'Die Ablesung findet am 05.11.2026 um 10:30 Uhr statt. Ort: Hausflur EG.',
};

/** What the capture sheet would show: the parser reading the prefilled text. */
const read = (text: string) => parseCapture(text, { now: NOW }).fields;

describe('mailPrefill', () => {
  it('invoice: payee, amount and due date from the mail, link in the note', () => {
    const p = mailPrefill('invoice', invoiceMail, { link, today: TODAY });
    const f = read(p.text);
    expect(f).toMatchObject({ amountMinor: 8430, date: '2026-11-15' });
    expect(f.title).toContain('Stadtwerke Musterstadt');
    expect(p.extra).toEqual({ note: link });
  });

  it('invoice without recognisable amount still offers sender and an empty rest', () => {
    const p = mailPrefill(
      'invoice',
      { ...invoiceMail, text: 'Hallo.', subject: 'Hallo' },
      { link, today: TODAY },
    );
    expect(p.text).toBe('Stadtwerke Musterstadt');
  });

  it('event: subject, date and time from the mail', () => {
    const p = mailPrefill('event', eventMail, { link, today: TODAY });
    const f = read(p.text);
    expect(f).toMatchObject({ date: '2026-11-05', time: '10:30' });
    expect(f.title).toContain('Termin Ablesung Heizung');
    expect(p.extra.note).toBe(link);
  });

  it('reminder: tomorrow 09:00', () => {
    const p = mailPrefill('reminder', eventMail, { link, today: TODAY });
    expect(read(p.text)).toMatchObject({ date: '2026-10-30', time: '09:00' });
  });

  it('todo and bookmark: the subject, the link where it belongs', () => {
    const todo = mailPrefill(
      'todo',
      { ...invoiceMail, subject: 'AW: Ihre Frage' },
      { link, today: TODAY },
    );
    expect(todo.text).toBe('Ihre Frage');
    expect(todo.extra).toEqual({ note: link });
    const mark = mailPrefill('bookmark', invoiceMail, { link, today: TODAY });
    expect(mark.extra).toEqual({ url: link });
  });

  it('note: the mail text is copied only when asked for', () => {
    const without = mailPrefill('note', invoiceMail, { link, today: TODAY });
    expect(without.extra.note).toBe(link);
    expect(without.excerpt).toContain('Ihre Rechnung über 84,30 EUR');
    const withText = mailPrefill('note', invoiceMail, { link, today: TODAY, withExcerpt: true });
    expect(withText.extra.note).toContain(link);
    expect(withText.extra.note).toContain('Ihre Rechnung über 84,30 EUR');
  });

  it('sample mail has no link: nothing is stored for it', () => {
    for (const type of ['invoice', 'event', 'todo', 'reminder', 'bookmark'] as const)
      expect(mailPrefill(type, invoiceMail, { today: TODAY }).extra).toEqual({});
    expect(mailPrefill('note', invoiceMail, { today: TODAY }).extra.note).toBeUndefined();
  });

  it('reads HTML mail as plain text', () => {
    expect(mailText({ html: '<p>Betrag <b>12,00 EUR</b></p><style>p{color:red}</style>' })).toBe(
      'Betrag 12,00 EUR',
    );
  });
});

describe('stored mail links carry no address (U17) and point back to the thread (U09)', () => {
  const ref = { key: 'google', connectorId: 'google', email: 'me@example.org' };

  it('`forStorage` drops `?authuser=`; the opening link keeps the account', () => {
    expect(mailWebUrl(ref, 't1')).toContain('authuser=');
    const stored = mailWebUrl(ref, 't1', { forStorage: true });
    expect(stored).toBe('https://mail.google.com/mail/#all/t1');
  });

  it('none of the six target types stores `authuser` or an `@` in note or url', () => {
    const stored = mailWebUrl(ref, 't1', { forStorage: true });
    expect(stored).toBeTruthy();
    for (const type of MAIL_LINK_TYPES) {
      for (const mail of [invoiceMail, eventMail]) {
        const p = mailPrefill(type, mail, { link: stored, threadId: 't1', today: TODAY });
        for (const value of [p.extra.note, p.extra.url]) {
          expect(value ?? '', `${type}: ${value}`).not.toMatch(/authuser|@/);
        }
        expect(p.extra.link).toEqual({ kind: 'mail', id: 't1', label: expect.any(String) });
      }
    }
  });
});
