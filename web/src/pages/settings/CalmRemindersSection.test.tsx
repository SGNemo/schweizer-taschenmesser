// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { t } from '@/strings';
import { CalmRemindersSection } from './CalmRemindersSection';

const g = t.settings.appearanceGroups;
const s = t.focus.reminders;
const group = (id: string) => screen.getByTestId(`calm-reminders-group-${id}`);

describe('Calm reminders, folded', () => {
  it('shows six closed lines with the defaults; every row sits inside its group', () => {
    render(<CalmRemindersSection />);
    const lines: [string, string, string][] = [
      ['inApp', s.inAppGroup, s.off],
      ['quiet', s.quietHours, '22:00–07:00'],
      ['limit', s.maxPerHour, '3'],
      ['staggered', s.staggered, s.off],
      ['followUp', s.followUp, [s.repeatEveryOption(30), s.repeatMaxOption(6)].join(' · ')],
      ['digest', s.todoDigest, '09:00'],
    ];
    for (const [id, title, value] of lines) {
      expect(group(id), id).not.toHaveAttribute('open');
      expect(within(group(id)).getByText(g.line(title, value)), id).toBeInTheDocument();
    }
    const rows: [string, string][] = [
      ['inAppPrompt', 'inApp'],
      ['quietHours', 'quiet'],
      ['quietTimes', 'quiet'],
      ['maxPerHour', 'limit'],
      ['staggered', 'staggered'],
      ['followUp', 'followUp'],
      ['repeatMinutes', 'followUp'],
      ['repeatMax', 'followUp'],
      ['todoDigest', 'digest'],
      ['digestTime', 'digest'],
    ];
    for (const [row, id] of rows) {
      expect(document.getElementById(`calm-reminders--${row}`)?.closest('details'), row).toBe(
        group(id),
      );
    }
  });

  it('switching the quiet hours off inside the open group turns the line to "Aus"', async () => {
    const user = userEvent.setup();
    render(<CalmRemindersSection />);
    const quiet = group('quiet');
    await user.click(within(quiet).getByText(g.change).closest('summary')!);
    expect(quiet).toHaveAttribute('open');
    await user.click(within(quiet).getByRole('switch', { name: s.quietHours }));
    expect(await within(quiet).findByText(g.line(s.quietHours, s.off))).toBeInTheDocument();
    expect(document.getElementById('calm-reminders--quietTimes')).toBeNull();
  });
});
