import { describe, expect, it } from 'vitest';
import { attachmentFileName } from './fileName';

describe('attachmentFileName', () => {
  it('keeps an ordinary name', () => {
    expect(attachmentFileName('Rechnung 2026-11.pdf')).toBe('Rechnung 2026-11.pdf');
  });
  it('never keeps a path: separators and colons become "-", so a sender cannot preselect a folder', () => {
    expect(attachmentFileName('..\\..\\Start Menu\\x.lnk')).toBe('-..-Start Menu-x.lnk');
    expect(attachmentFileName('/etc/cron.d/job')).toBe('-etc-cron.d-job');
    expect(attachmentFileName('C:\\Users\\Public\\a.txt')).toBe('C--Users-Public-a.txt');
    expect(attachmentFileName('Rechnung 03/2024.pdf')).toBe('Rechnung 03-2024.pdf');
    expect(attachmentFileName('Termin 10:30.ics')).toBe('Termin 10-30.ics');
  });
  it('removes control and direction characters and characters Windows forbids', () => {
    expect(attachmentFileName('rech\u202Efdp.exe')).toBe('rechfdp.exe');
    expect(attachmentFileName('a\u0000b\r\n.txt')).toBe('ab.txt');
    expect(attachmentFileName('a<b>:"c"|?*.txt')).toBe('a_b_-_c____.txt');
    expect(attachmentFileName('x\u061cfdp.exe')).toBe('xfdp.exe');
    expect(attachmentFileName('x\ud83d.pdf')).toBe('x.pdf');
  });
  it('never returns an empty, dot-only or overlong name', () => {
    expect(attachmentFileName('')).toBe('attachment');
    expect(attachmentFileName('..')).toBe('attachment');
    expect(attachmentFileName(' . ')).toBe('attachment');
    expect(attachmentFileName(`${'a'.repeat(400)}.pdf`).length).toBeLessThanOrEqual(150);
    expect(attachmentFileName(`${'a'.repeat(400)}.pdf`).endsWith('.pdf')).toBe(true);
  });
  it('stays fast on a name made of tens of thousands of spaces or dots', () => {
    const started = performance.now();
    expect(attachmentFileName(`${' '.repeat(200_000)}a.pdf${'.'.repeat(500)}`)).toBe('a.pdf');
    expect(attachmentFileName(`a.pdf${'.'.repeat(200_000)}`)).toBe('attachment');
    expect(attachmentFileName(' '.repeat(200_000))).toBe('attachment');
    expect(performance.now() - started).toBeLessThan(2000);
  });
  it('keeps umlauts and joined emoji as they are', () => {
    expect(attachmentFileName('Übersicht März.pdf')).toBe('Übersicht März.pdf');
    expect(attachmentFileName('\ud83d\udc69\u200d\ud83d\udcbb Notizen.pdf')).toBe(
      '\ud83d\udc69\u200d\ud83d\udcbb Notizen.pdf',
    );
  });
  it('cuts on whole characters and leaves no space before the ending', () => {
    const name = attachmentFileName(`${'😀'.repeat(200)} .pdf`);
    expect(Array.from(name).length).toBeLessThanOrEqual(150);
    expect(name.endsWith('😀.pdf')).toBe(true);
  });
});
