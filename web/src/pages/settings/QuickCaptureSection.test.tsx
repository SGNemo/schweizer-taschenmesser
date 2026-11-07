// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { t } from '@/strings';
import { tSettingsV31 } from '@/strings.settingsV31';
import { CaptureSample } from './QuickCaptureSection';

describe('quick capture settings: live sample', () => {
  it('shows what the example sentence would become, without typing', () => {
    render(<CaptureSample />);
    const chips = screen.getByRole('list', { name: tSettingsV31.get().quick.sampleResult });
    expect(
      within(chips).getByText(t.quickCapture.chip.to(t.quickCapture.target.event)),
    ).toBeInTheDocument();
    expect(within(chips).getByText(t.time.atClock('15:00'))).toBeInTheDocument();
  });

  it('the prefix „p“ sends a sentence to the planner', async () => {
    render(<CaptureSample />);
    await userEvent.type(
      screen.getByLabelText(tSettingsV31.get().quick.sampleLabel),
      'p Steuer machen',
    );
    const chips = screen.getByRole('list', { name: tSettingsV31.get().quick.sampleResult });
    expect(
      within(chips).getByText(t.quickCapture.chip.to(t.quickCapture.target.plan)),
    ).toBeInTheDocument();
  });
});
