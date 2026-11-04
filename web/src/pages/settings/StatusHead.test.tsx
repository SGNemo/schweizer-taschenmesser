// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { tSettingsV3 } from '@/strings.settingsV3';
import { StatusHead } from './StatusHead';

describe('settings status head', () => {
  it('shows the six states, each a link into its category with a context line', async () => {
    render(
      <MemoryRouter>
        <StatusHead title="Einstellungen" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
    const list = screen.getByTestId('settings-status');
    const links = within(list).getAllByRole('link');
    expect(links).toHaveLength(6);
    const ids = ['security', 'sync', 'backup', 'updates', 'ai', 'storage'].map(
      (id) => `overview-${id}`,
    );
    expect(links.map((l) => l.getAttribute('data-testid'))).toEqual(ids);
    for (const l of links) {
      expect(l.getAttribute('href')).toMatch(/^\/settings\//);
      // name + state + context: three text lines per tile (a number never stands alone)
      expect(l.querySelectorAll('span')).toHaveLength(3);
    }
    expect(within(list).getByText(tSettingsV3.get().tiles.backup)).toBeInTheDocument();
  });
});
