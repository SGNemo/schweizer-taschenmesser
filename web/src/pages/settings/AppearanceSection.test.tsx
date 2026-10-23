// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { AppearanceSection } from './AppearanceSection';

const g = t.settings.appearanceGroups;

beforeEach(() => {
  useUiStore.setState({ theme: 'light', textSize: 'normal', motion: 'system' });
});

describe('Appearance settings, grouped', () => {
  it('shows only the current choice per group, the pickers stay folded', () => {
    render(<AppearanceSection />);
    const theme = screen.getByTestId('appearance-group-theme');
    expect(within(theme).getByText(g.line(g.theme, t.settings.themeLight))).toBeInTheDocument();
    expect(within(theme).getByText(g.change)).toBeInTheDocument();
    expect(theme).not.toHaveAttribute('open');
    for (const id of ['theme', 'colors', 'text', 'motion', 'other']) {
      expect(screen.getByTestId(`appearance-group-${id}`)).not.toHaveAttribute('open');
    }
  });

  it('opens a group with "Ändern", the picker changes the value and the line follows', async () => {
    const user = userEvent.setup();
    render(<AppearanceSection />);
    const theme = screen.getByTestId('appearance-group-theme');
    const summary = within(theme).getByText(g.change).closest('summary')!;
    expect(summary).toHaveAttribute('aria-expanded', 'false');
    await user.click(summary);
    expect(theme).toHaveAttribute('open');
    expect(summary).toHaveAttribute('aria-expanded', 'true');
    expect(within(summary).getByText(g.done)).toBeInTheDocument();
    await user.click(within(theme).getByRole('button', { name: t.settings.themeDark }));
    expect(useUiStore.getState().theme).toBe('dark');
    expect(within(theme).getByText(g.line(g.theme, t.settings.themeDark))).toBeInTheDocument();
  });

  it('keeps every field reachable: all rows exist inside their group', () => {
    render(<AppearanceSection />);
    const ids = ['theme', 'accent', 'palette', 'color', 'textSize', 'leading', 'density'];
    ids.push('motion', 'sidebar', 'homeView', 'logo');
    for (const id of ids) {
      const row = document.getElementById(`appearance--${id}`);
      expect(row, id).not.toBeNull();
      expect(row!.closest('details'), id).not.toBeNull();
    }
  });
});
