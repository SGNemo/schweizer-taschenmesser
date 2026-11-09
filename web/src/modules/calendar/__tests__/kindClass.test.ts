import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CalendarItem } from '@/core/modules/types';
import { kindClass } from '../components/ItemRow';

const TODAY = '2026-09-29';
const item = (kind: string, date: string, done = false): CalendarItem => ({
  id: kind,
  source: 'test',
  kind,
  title: kind,
  date,
  allDay: true,
  done,
});

/** The declarations of one top-level rule of the calendar CSS module whose selector list contains `selector`. */
function rule(selector: string): string {
  const css = readFileSync(join(__dirname, '../routes/calendar.module.css'), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  );
  const out: string[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = m[1]!.split(',').map((s) => s.trim());
    if (selectors.includes(selector)) out.push(m[2]!);
  }
  return out.join('\n');
}

describe('calendar kind badges (U08: red only when overdue)', () => {
  it('a deadline that is still coming keeps its kind class', () => {
    expect(kindClass(item('invoice', '2026-10-01'), TODAY)).toBe('kind_invoice');
    expect(kindClass(item('cancel', TODAY), TODAY)).toBe('kind_cancel');
    expect(kindClass(item('end', '2026-12-31'), TODAY)).toBe('kind_end');
    expect(kindClass(item('expiry', '2026-10-05'), TODAY)).toBe('kind_expiry');
  });

  it('an open deadline in the past is overdue; a finished one or a past event is not', () => {
    expect(kindClass(item('invoice', '2026-09-20'), TODAY)).toBe('kind_overdue');
    expect(kindClass(item('cancel', '2026-09-28'), TODAY)).toBe('kind_overdue');
    expect(kindClass(item('invoice', '2026-09-20', true), TODAY)).toBe('kind_invoice');
    expect(kindClass(item('event', '2026-09-20'), TODAY)).toBe('kind_event');
    expect(kindClass(item('birthday', '2026-09-20'), TODAY)).toBe('kind_birthday');
  });

  it('only the overdue class is red: invoice neutral, cancellation/end/expiry a warning', () => {
    expect(rule('.kind_invoice')).not.toMatch(/--danger/);
    expect(rule('.kind_invoice')).toMatch(/color: var\(--text\)/);
    for (const kind of ['cancel', 'end', 'expiry']) {
      expect(rule(`.kind_${kind}`)).not.toMatch(/--danger/);
      expect(rule(`.kind_${kind}`)).toMatch(/--warning/);
    }
    expect(rule('.kind_overdue')).toMatch(/--danger/);
  });
});
