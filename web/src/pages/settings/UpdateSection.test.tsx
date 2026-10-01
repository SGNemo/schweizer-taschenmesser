// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/core/platform', () => ({
  getPlatform: () => ({
    updater: { supported: true },
    app: { version: async () => '0.3.2-dev.57' },
  }),
}));
vi.mock('@/core/update/prefs', () => ({
  loadPrefs: async () => ({ channel: 'stable', auto: true }),
  savePrefs: async () => ({ channel: 'stable', auto: true }),
}));
vi.mock('@/core/update/buildInfo', () => ({ BUILD_SHA: 'abcdef0', isDevBuild: () => true }));

import { UpdateSection } from './UpdateSection';

describe('UpdateSection in a Dev-Preview build', () => {
  it('shows the dev version and a fixed dev channel instead of the stable/beta choice', async () => {
    render(<UpdateSection />);
    await waitFor(() => expect(screen.getByTestId('update-channel-dev')).toBeTruthy());
    expect(screen.getByTestId('app-version').textContent).toContain(
      'Dev-Preview 0.3.2-dev.57 (abcdef0)',
    );
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});
