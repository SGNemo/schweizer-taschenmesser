// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { ReadingSection } from './ReadingSection';

const g = t.settings.appearanceGroups;
const r = t.settings.reading;

beforeEach(() => {
  useUiStore.setState({ readAid: false, readShare: '40', readStyle: 'soft', readCover: '50' });
});

describe('Reading settings, folded', () => {
  it('shows one line with "Aus" while the aid is off; every row and the preview sit inside', () => {
    render(<ReadingSection />);
    const group = screen.getByTestId('reading-group-aid');
    expect(group).not.toHaveAttribute('open');
    expect(within(group).getByText(g.line(r.aid, r.off))).toBeInTheDocument();
    for (const id of ['aid', 'share', 'style', 'cover', 'preview']) {
      const row = document.getElementById(`reading--${id}`);
      expect(row, id).not.toBeNull();
      expect(row!.closest('details'), id).toBe(group);
    }
  });

  it('"Ändern" opens the group; the switch turns the aid on and the line names the choices', async () => {
    const user = userEvent.setup();
    render(<ReadingSection />);
    const group = screen.getByTestId('reading-group-aid');
    await user.click(within(group).getByText(g.change).closest('summary')!);
    expect(group).toHaveAttribute('open');
    await user.click(within(group).getByRole('switch', { name: r.aid }));
    expect(useUiStore.getState().readAid).toBe(true);
    const line = [r.on, r.shareOptions['40'], r.styleOptions.soft, r.coverOptions['50']].join(
      ' · ',
    );
    expect(within(group).getByText(g.line(r.aid, line))).toBeInTheDocument();
  });
});
