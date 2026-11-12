// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HeroControlsContext } from '@/core/shell/heroContext';
import { Button } from './Button';
import { EmptyState } from './Misc';
import { Segmented } from './Patterns';
import { SensitiveValue } from './SensitiveValue';

/** The window is a phone or a desktop (`matchMedia`). */
function windowIs(phone: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: phone && query.includes('max-width: 899px'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

vi.mock('@/core/focus/hideValues', () => ({ useHideValues: () => true }));

afterEach(() => vi.unstubAllGlobals());

/** Findings of the design check of packages 0b-1 to 0b-3 (docs/design/ui-audit-2026-11/DESIGN-CHECK-0b-1-3.md). */
describe('design check: one filled button on the phone (F2)', () => {
  const empty = (
    <EmptyState title="Noch nichts da.">
      <Button variant="primary">Erste Buchung eintragen</Button>
    </EmptyState>
  );
  const inShell = (
    <HeroControlsContext.Provider value={{} as never}>{empty}</HeroControlsContext.Provider>
  );

  it('steps back to secondary on the phone inside the shell: the plus is the filled one', () => {
    windowIs(true);
    render(inShell);
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'secondary');
  });

  it('stays filled on the desktop', () => {
    windowIs(false);
    render(inShell);
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'primary');
  });

  it('stays filled outside the shell, where no bottom bar holds a plus', () => {
    windowIs(true);
    render(empty);
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'primary');
  });
});

describe('design check: the edge fade of a Segmented (F1)', () => {
  it('marks a row that fits as not overflowing, so the style sheet draws no fade', () => {
    render(
      <Segmented
        label="Art"
        value="a"
        options={[
          { value: 'a', label: 'Ausgabe' },
          { value: 'b', label: 'Einnahme' },
        ]}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByRole('group', { name: 'Art' })).toHaveAttribute('data-overflow', 'false');
  });
});

describe('design check: a hidden figure in the module head (K1)', () => {
  it('shows no hint sentence in the compact mask; the hint is the name and the tooltip', () => {
    render(<SensitiveValue compact>11.598,49 €</SensitiveValue>);
    const mask = screen.getByTestId('sensitive-value');
    expect(mask).not.toHaveTextContent('Zum Einblenden tippen');
    expect(mask).toHaveAccessibleName('Ausgeblendet. Zum Einblenden tippen');
    expect(mask).not.toHaveTextContent('11.598');
  });
});
