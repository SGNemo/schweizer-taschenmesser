// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setHideValues } from '@/core/focus/hideValues';
import { MonthCurve } from '../components/MonthCurve';

const points = [
  { date: '2026-10-31', balanceMinor: 1_137_197 },
  { date: '2026-11-01', balanceMinor: 1_423_509 },
  { date: '2026-11-13', balanceMinor: 1_261_633 },
];
const plain = (s: string | null | undefined) => (s ?? '').replace(/\s/g, ' ');

describe('month curve on the overview (0b-8: G9, curve without a zero point)', () => {
  beforeEach(async () => {
    await db.table('_meta').clear();
  });

  it('draws a line without a filled area and names the end day, not the balance a second time', async () => {
    render(<MonthCurve points={points} />);
    const svg = await screen.findByTestId('month-curve');
    await waitFor(() => expect(svg.getAttribute('aria-label')).toMatch(/12\.616,33/));
    // One path: the line. A fill down to the lower edge would read as a scale from zero.
    expect(svg.querySelectorAll('path')).toHaveLength(1);
    const foot = plain(screen.getByTestId('month-curve-foot').textContent);
    expect(foot).toContain('11.371,97 €');
    expect(foot).not.toContain('12.616,33');
    expect(foot).toContain('13.11.2026');
  });

  it('"Werte ausblenden" masks every amount: the foot and the label', async () => {
    await setHideValues(true);
    render(<MonthCurve points={points} />);
    const svg = await screen.findByTestId('month-curve');
    await waitFor(() => expect(svg.getAttribute('aria-label')).toBe('Verlauf im Monat'));
    const foot = plain(screen.getByTestId('month-curve-foot').textContent);
    expect(foot).not.toMatch(/\d+,\d\d/);
  });
});
