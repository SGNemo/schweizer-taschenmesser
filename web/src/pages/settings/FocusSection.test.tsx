// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { t } from '@/strings';
import { FocusSection } from './FocusSection';

const g = t.settings.appearanceGroups;
const s = t.focus.settings;

describe('Focus settings, folded', () => {
  it('shows two closed lines with the counts; all fourteen rows stay inside a group', () => {
    render(<FocusSection />);
    const aids = screen.getByTestId('focus-group-aids');
    const more = screen.getByTestId('focus-more');
    expect(aids).not.toHaveAttribute('open');
    expect(more).not.toHaveAttribute('open');
    expect(within(aids).getByText(g.line(s.aids, s.aidsOn(6, 6)))).toBeInTheDocument();
    const moreLine = [s.planShort(3), s.timerShort(25), s.aidsOn(2, 6)].join(' · ');
    expect(within(more).getByText(g.line(s.more, moreLine))).toBeInTheDocument();
    const ids = [
      'nextOne',
      'dayPlan',
      'calmAttention',
      'timeToNext',
      'resumeCard',
      'eveningWrapUp',
    ];
    for (const id of ids)
      expect(document.getElementById(`focus--${id}`)?.closest('details')).toBe(aids);
    const extras = ['planLimit', 'focusMinutes', 'moduleNow', 'focusSound', 'focusIndicator'];
    extras.push('streaks', 'weekReview', 'searchHistory', 'clearHistory');
    for (const id of extras)
      expect(document.getElementById(`focus--${id}`)?.closest('details')).toBe(more);
  });

  it('switching an aid off inside the open group updates the count on the line', async () => {
    const user = userEvent.setup();
    render(<FocusSection />);
    const aids = screen.getByTestId('focus-group-aids');
    await user.click(within(aids).getByText(g.change).closest('summary')!);
    expect(aids).toHaveAttribute('open');
    await user.click(within(aids).getByRole('switch', { name: s.nextOne }));
    expect(await within(aids).findByText(g.line(s.aids, s.aidsOn(5, 6)))).toBeInTheDocument();
  });
});
