import { describe, expect, it } from 'vitest';
import { attachmentFileName } from './fileName';

describe('attachmentFileName', () => {
  it('keeps an ordinary name', () => {
    expect(attachmentFileName('Rechnung 2026-11.pdf')).toBe('Rechnung 2026-11.pdf');
  });
  it('keeps only the last path part, so a sender cannot preselect a folder', () => {
    expect(
      attachmentFileName('..\\..\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\x.lnk'),
    ).toBe('x.lnk');
    expect(attachmentFileName('/etc/cron.d/job')).toBe('job');
    expect(attachmentFileName('C:\\Users\\Public\\a.txt')).toBe('a.txt');
  });
  it('removes control and direction characters and characters Windows forbids', () => {
    expect(attachmentFileName('rech\u202Efdp.exe')).toBe('rechfdp.exe');
    expect(attachmentFileName('a\u0000b\r\n.txt')).toBe('ab.txt');
    expect(attachmentFileName('a<b>:"c"|?*.txt')).toBe('a_b___c____.txt');
  });
  it('never returns an empty, dot-only or overlong name', () => {
    expect(attachmentFileName('')).toBe('attachment');
    expect(attachmentFileName('..')).toBe('attachment');
    expect(attachmentFileName(' . ')).toBe('attachment');
    expect(attachmentFileName(`${'a'.repeat(400)}.pdf`).length).toBeLessThanOrEqual(150);
    expect(attachmentFileName(`${'a'.repeat(400)}.pdf`).endsWith('.pdf')).toBe(true);
  });
});
