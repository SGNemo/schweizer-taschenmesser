// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { useSetupHost } from '@/core/setup/host';
import { updateSetupState } from '@/core/setup/state';
import { t } from '@/strings';
import { SetupSection } from './SetupSection';

afterEach(() => useSetupHost.getState().close());

describe('Settings → Einrichtung', () => {
  it('shows one primary action and never opens the assistant by itself', async () => {
    render(<SetupSection />);
    const start = await screen.findByRole('button', { name: t.setup.start }, { timeout: 15_000 });
    expect(useSetupHost.getState().open).toBe(false);
    await userEvent.click(start);
    expect(useSetupHost.getState().open).toBe(true);
    expect(useSetupHost.getState().stepId).toBeNull();
  }, 20_000);

  it('an open step opens the assistant right at that step', async () => {
    // The start migration writes the device-local progress row; without it there is no list yet.
    await updateSetupState((s) => s);
    render(<SetupSection />);
    const rows = await screen.findAllByRole(
      'button',
      { name: new RegExp(`: ${t.setup.openStep}$`) },
      { timeout: 15_000 },
    );
    await userEvent.click(rows[0]!);
    expect(useSetupHost.getState().stepId).toBeTruthy();
  }, 20_000);
});
