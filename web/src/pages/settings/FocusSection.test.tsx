// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { getHideValues, setHideValues } from '@/core/focus/hideValues';
import { t } from '@/strings';
import { FocusSection } from './FocusSection';

const g = t.settings.appearanceGroups;
const s = t.focus.settings;

describe('Focus settings, folded', () => {
  it('shows two closed lines with the counts; all fourteen rows stay inside a group', () => {
    render(
      <MemoryRouter>
        <FocusSection />
      </MemoryRouter>,
    );
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
    render(
      <MemoryRouter>
        <FocusSection />
      </MemoryRouter>,
    );
    const aids = screen.getByTestId('focus-group-aids');
    await user.click(within(aids).getByText(g.change).closest('summary')!);
    expect(aids).toHaveAttribute('open');
    await user.click(within(aids).getByRole('switch', { name: s.nextOne }));
    expect(await within(aids).findByText(g.line(s.aids, s.aidsOn(5, 6)))).toBeInTheDocument();
  });

  it('"Werte ausblenden" waits for its stored value: never "on" before it is read, one tap turns it on', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <FocusSection />
      </MemoryRouter>,
    );
    // First render: the value is still being read. The switch is neither "on" nor usable.
    const hide = screen.getByRole('switch', { name: s.hideValues, hidden: true });
    expect(hide).toHaveAttribute('aria-checked', 'false');
    expect(hide).toBeDisabled();
    await waitFor(() => expect(hide).toBeEnabled());
    expect(hide).toHaveAttribute('aria-checked', 'false');
    try {
      await user.click(screen.getByTestId('focus-more').querySelector('summary')!);
      await user.click(hide);
      await waitFor(() => expect(hide).toHaveAttribute('aria-checked', 'true'));
      expect(await getHideValues()).toBe(true);
    } finally {
      await setHideValues(false);
    }
  });
});
