import { describe, expect, it } from 'vitest';
import { parseLines } from './textLines';

describe('parseLines', () => {
  it('splits lines, trims and drops empty ones and list markers', () => {
    const text =
      ' Milch kaufen \r\n\r\n- Brot\n* Käse\n• Eier\n1. Butter\n2) Salz\n[ ] Pfeffer\n[x] Zucker\n☐ Mehl\n';
    expect(parseLines(text)).toEqual([
      'Milch kaufen',
      'Brot',
      'Käse',
      'Eier',
      'Butter',
      'Salz',
      'Pfeffer',
      'Zucker',
      'Mehl',
    ]);
  });

  it('keeps hyphens inside words and numbers that are not list markers', () => {
    expect(parseLines('E-Mail prüfen\n2 Milch\n-5 Grad')).toEqual([
      'E-Mail prüfen',
      '2 Milch',
      '-5 Grad',
    ]);
  });

  it('stops at max', () => {
    expect(parseLines('a\nb\nc', { max: 2 })).toEqual(['a', 'b']);
  });
});
