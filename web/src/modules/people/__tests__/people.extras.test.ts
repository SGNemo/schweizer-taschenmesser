import { describe, expect, it } from 'vitest';
import { parseDateValue, parseIcs, parseVcf } from '../contactsImport';
import { budgetLeft, closeness, congratsLinks, monogram } from '../logic';
import { giftSchema } from '../schema';

describe('congratulating', () => {
  it('always offers WhatsApp, a call and a mail only with valid details', () => {
    expect(congratsLinks({}, 'Hi', 'Subj').map((l) => l.id)).toEqual(['whatsapp']);
    const links = congratsLinks({ phone: '+49 151 234567', email: 'a@b.de' }, 'Hi', 'Subj');
    expect(links.map((l) => l.id)).toEqual(['whatsapp', 'tel', 'mail']);
    expect(links[0]!.url).toBe('https://wa.me/49151234567?text=Hi');
    expect(links[1]!.url).toBe('tel:+49151234567');
    expect(links[2]!.url).toBe('mailto:a@b.de?subject=Subj&body=Hi');
  });

  it('never builds a link from something that is not a number or an address', () => {
    const links = congratsLinks({ phone: 'javascript:alert(1)', email: 'x" onclick=' }, 'Hi', 'S');
    expect(links.map((l) => l.id)).toEqual(['whatsapp']);
  });
});

describe('avatar and budget helpers', () => {
  it('takes initials from the first and the last word', () => {
    expect(monogram('anna maria beispiel')).toBe('AB');
    expect(monogram('Oma')).toBe('O');
    expect(monogram('  ')).toBe('?');
  });
  it('fills the ring towards the birthday', () => {
    expect(closeness(0)).toBe(1);
    expect(closeness(30)).toBe(0);
    expect(closeness(60)).toBe(0);
    expect(closeness(15)).toBe(0.5);
  });
  it('subtracts what was bought or given from the budget', () => {
    const g = (status: 'idea' | 'bought' | 'given', priceCents: number) =>
      giftSchema.parse({ personId: 'p', title: 'x', status, priceCents });
    expect(budgetLeft(5000, [g('idea', 3000), g('bought', 2000), g('given', 1500)])).toBe(1500);
    expect(budgetLeft(1000, [g('bought', 2500)])).toBe(-1500);
  });
});

describe('contacts and calendar files', () => {
  it('reads birthday date forms', () => {
    expect(parseDateValue('19850315')).toEqual({ month: 3, day: 15, year: 1985 });
    expect(parseDateValue('1985-03-15')).toEqual({ month: 3, day: 15, year: 1985 });
    expect(parseDateValue('--0315')).toEqual({ month: 3, day: 15 });
    expect(parseDateValue('16040315')).toEqual({ month: 3, day: 15 }); // placeholder year
    expect(parseDateValue('nope')).toBeUndefined();
  });

  it('parses vCards with folded lines and skips cards without a birthday', () => {
    const vcf = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:Anna Beispiel',
      'BDAY:1985-03-15',
      'TEL;TYPE=CELL:+49 151 234567',
      'EMAIL:anna@example.org',
      'END:VCARD',
      'BEGIN:VCARD',
      'N:Muster;Max;;;',
      'BDAY:--11-02',
      'END:VCARD',
      'BEGIN:VCARD',
      'FN:Ohne Datum',
      'END:VCARD',
    ].join('\r\n');
    expect(parseVcf(vcf)).toEqual([
      {
        name: 'Anna Beispiel',
        month: 3,
        day: 15,
        year: 1985,
        phone: '+49 151 234567',
        email: 'anna@example.org',
      },
      { name: 'Max Muster', month: 11, day: 2 },
    ]);
  });

  it('turns yearly all-day events of a birthday calendar into people, without the year', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Geburtstag von Oma',
      'DTSTART;VALUE=DATE:19400224',
      'RRULE:FREQ=YEARLY',
      'END:VEVENT',
      'BEGIN:VEVENT',
      "SUMMARY:Anna's birthday",
      'DTSTART;VALUE=DATE:20000101',
      'RRULE:FREQ=YEARLY',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'SUMMARY:Zahnarzt',
      'DTSTART:20261104T090000',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
    expect(parseIcs(ics)).toEqual([
      { name: 'Oma', month: 2, day: 24 },
      { name: 'Anna', month: 1, day: 1 },
    ]);
  });
});
