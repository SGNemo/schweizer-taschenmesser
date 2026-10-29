// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { clearFrequent, recordSectionVisit } from '@/core/settings/frequent';
import { t } from '@/strings';
import { tWeather } from '@/strings.weather';
import { tComfort } from '@/strings.comfort';
import { CategoryNav } from './SettingsLayout';

afterEach(() => clearFrequent());

describe('settings navigation column', () => {
  it('stays one element when "Häufig genutzt" appears (the desktop grid has two columns)', async () => {
    recordSectionVisit('weather');
    recordSectionVisit('weather');
    const { container } = render(
      <MemoryRouter>
        <CategoryNav />
      </MemoryRouter>,
    );
    const column = await screen.findByTestId('settings-nav');
    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild).toBe(column);
    // The sections (and with them the frequent list) arrive once the module states are loaded.
    const frequent = await within(column).findByRole('navigation', {
      name: tComfort.get().frequent.title,
    });
    expect(within(frequent).getByText(tWeather.get().title)).toBeInTheDocument();
    expect(
      within(column).getByRole('navigation', { name: t.settings.categoriesNav }),
    ).toBeInTheDocument();
    expect(container.children).toHaveLength(1);
  });
});
