// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RecurrenceEditor } from './RecurrenceEditor';
import type { Recurrence } from './types';

const monthly: Recurrence = { freq: 'monthly', interval: 1 };
const noop = () => {};

describe('RecurrenceEditor parts (0b-8 G8: interval and end behind "Mehr Felder")', () => {
  it('all (default, calendar and ToDos): frequency, interval and end in one place', () => {
    render(<RecurrenceEditor value={monthly} onChange={noop} startDate="2026-09-15" />);
    expect(screen.getByLabelText('Wiederholung')).toBeTruthy();
    expect(screen.getByLabelText(/^Alle/)).toBeTruthy();
    expect(screen.getByLabelText('Ende')).toBeTruthy();
  });

  it('basic: only how often (the day of the month stays with it)', () => {
    render(
      <RecurrenceEditor
        value={{ ...monthly, byMonthDay: 3 }}
        onChange={noop}
        startDate="2026-09-15"
        followStartDay
        parts="basic"
      />,
    );
    expect(screen.getByLabelText('Wiederholung')).toBeTruthy();
    expect(screen.getByLabelText('Tag des Monats')).toBeTruthy();
    expect(screen.queryByLabelText(/^Alle/)).toBeNull();
    expect(screen.queryByLabelText('Ende')).toBeNull();
  });

  it('more: the interval and the end, without the frequency', () => {
    render(
      <RecurrenceEditor value={monthly} onChange={noop} startDate="2026-09-15" parts="more" />,
    );
    expect(screen.queryByLabelText('Wiederholung')).toBeNull();
    expect(screen.getByLabelText(/^Alle/)).toBeTruthy();
    expect(screen.getByLabelText('Ende')).toBeTruthy();
  });

  it('the end date is a day field that starts at the start date', () => {
    render(
      <RecurrenceEditor
        value={{ ...monthly, until: '2026-09-01' }}
        onChange={noop}
        startDate="2026-09-15"
      />,
    );
    const end = screen.getByLabelText('Enddatum') as HTMLInputElement;
    expect(end.type).toBe('text');
    expect(end.validity.valid).toBe(false);
  });
});
