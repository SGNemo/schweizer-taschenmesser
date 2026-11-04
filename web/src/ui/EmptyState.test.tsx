// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './Misc';

describe('EmptyState', () => {
  it('draws the Nemo fish by default and a heading with the sentence', () => {
    const { container } = render(<EmptyState title="Noch nichts da." />);
    expect(screen.getByRole('heading', { name: 'Noch nichts da.' })).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('[data-motif]')).toBeNull();
  });

  it('shows the module motif instead of the fish, with the test id on the wrapper', () => {
    const { container } = render(
      <EmptyState
        title="Noch keine Notizen."
        testId="demo-empty"
        motif={<svg data-motif="demo" aria-hidden="true" />}
      />,
    );
    expect(screen.getByTestId('demo-empty')).toContainElement(
      container.querySelector('[data-motif="demo"]') as HTMLElement,
    );
    // the fish is gone: the only drawing is the motif
    expect(container.querySelectorAll('svg')).toHaveLength(1);
  });

  it('keeps the fish in the compact variant (dashboard widgets) even when a motif is given', () => {
    const { container } = render(
      <EmptyState compact title="Leer" motif={<svg data-motif="demo" aria-hidden="true" />} />,
    );
    expect(container.querySelector('[data-motif]')).toBeNull();
    expect(screen.getByText('Leer')).toBeInTheDocument();
  });
});
