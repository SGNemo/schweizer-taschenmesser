// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let advanced = false;
const setAdvanced = vi.fn((v: boolean) => {
  advanced = v;
});
vi.mock('@/core/settings/comfort', () => ({
  useAdvanced: () => [advanced, setAdvanced] as const,
}));

import { AdvancedFields, AdvancedToggle } from './AdvancedFields';

describe('AdvancedFields', () => {
  beforeEach(() => {
    advanced = false;
    setAdvanced.mockClear();
  });

  it('hides the rare fields in Basis and offers "Mehr Felder"', () => {
    render(
      <AdvancedFields moduleId="todos">
        <input aria-label="Notiz" />
      </AdvancedFields>,
    );
    expect(screen.queryByLabelText('Notiz')).toBeNull();
    expect(screen.getByRole('button', { name: 'Mehr Felder anzeigen' })).toBeInTheDocument();
  });

  it('"Mehr Felder" reveals them for this form only and does not change the setting', async () => {
    const user = userEvent.setup();
    render(
      <AdvancedFields moduleId="todos">
        <input aria-label="Notiz" />
      </AdvancedFields>,
    );
    await user.click(screen.getByRole('button', { name: 'Mehr Felder anzeigen' }));
    expect(screen.getByLabelText('Notiz')).toBeInTheDocument();
    expect(setAdvanced).not.toHaveBeenCalled();
  });

  it('shows the fields in Erweitert, and whenever one of them holds data', () => {
    advanced = true;
    const { rerender } = render(
      <AdvancedFields moduleId="todos">
        <input aria-label="Notiz" />
      </AdvancedFields>,
    );
    expect(screen.getByLabelText('Notiz')).toBeInTheDocument();
    advanced = false;
    rerender(
      <AdvancedFields moduleId="todos" hasData>
        <input aria-label="Notiz" />
      </AdvancedFields>,
    );
    expect(screen.getByLabelText('Notiz')).toBeInTheDocument();
  });

  it('the header switch reports the choice', async () => {
    const user = userEvent.setup();
    render(<AdvancedToggle moduleId="todos" />);
    await user.click(screen.getByRole('switch', { name: 'Mehr Felder anzeigen' }));
    expect(setAdvanced).toHaveBeenCalledWith(true);
  });
});
