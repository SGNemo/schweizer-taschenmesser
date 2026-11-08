// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { updateSetupState } from '@/core/setup/state';
import { CategoryStatus } from './CategoryStatus';

describe('category status: Einrichtung', () => {
  it('shows "n von m" while setup steps are open', async () => {
    await updateSetupState((s) => s);
    render(<CategoryStatus id="einrichtung" />);
    expect(
      await screen.findByText(/^\d+ von \d+$/, undefined, { timeout: 15_000 }),
    ).toBeInTheDocument();
  }, 20_000);
});
