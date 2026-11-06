// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { tSettingsV31 } from '@/strings.settingsV31';
import { Button, SettingRow, SettingsGroup, Switch } from '@/ui';
import { SettingsHead } from './SettingsHead';
import { StatusCard } from './StatusCard';

describe('settings identity v3.1 building blocks', () => {
  it('the status card says the state in words; figure and icon are decoration; one action', () => {
    render(
      <StatusCard
        testId="s"
        titleTestId="s-title"
        title="4 von 9 erledigt"
        line="Als Nächstes: Sync"
        figure={<svg data-testid="fig" />}
        action={<Button variant="primary">Einrichtung fortsetzen</Button>}
      />,
    );
    const card = screen.getByTestId('s');
    expect(screen.getByTestId('s-title')).toHaveTextContent('4 von 9 erledigt');
    expect(card).toHaveTextContent('Als Nächstes: Sync');
    expect(screen.getByTestId('fig').parentElement?.getAttribute('aria-hidden')).toBe('true');
    expect(within(card).getAllByRole('button')).toHaveLength(1);
    expect(card.getAttribute('data-tinted')).toBe('true');
  });

  it('a plain group is a named region with a heading and rows, no card', () => {
    const { container } = render(
      <SettingsGroup id="g" title="Im Hintergrund" plain>
        <SettingRow
          label="Mit Windows starten"
          description="Nemo startet leise"
          hint="Lange Erklärung"
        >
          <Switch label="Mit Windows starten" labelHidden checked={false} onChange={() => {}} />
        </SettingRow>
      </SettingsGroup>,
    );
    const group = screen.getByRole('region', { name: 'Im Hintergrund' });
    expect(
      within(group).getByRole('heading', { level: 2, name: 'Im Hintergrund' }),
    ).toBeInTheDocument();
    expect(within(group).getByRole('switch', { name: 'Mit Windows starten' })).toBeInTheDocument();
    // The long explanation sits behind the ⓘ button, the row keeps one line.
    expect(within(group).getByText('Nemo startet leise')).toBeInTheDocument();
    expect(container.querySelector('[class*="card"]')).toBeNull();
  });

  it('the tab head of "Einrichtung" carries the title and one line', async () => {
    render(
      <MemoryRouter initialEntries={['/settings/einrichtung']}>
        <SettingsHead />
      </MemoryRouter>,
    );
    const o = tSettingsV31.get().setupCat;
    expect(await screen.findByRole('heading', { level: 1, name: o.title })).toBeInTheDocument();
    expect(screen.getByText(o.description)).toBeInTheDocument();
    expect(screen.getByTestId('settings-head-einrichtung').getAttribute('data-hue')).toBe('fern');
  });
});
