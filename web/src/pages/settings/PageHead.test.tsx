// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHead } from './PageHead';

describe('PageHead', () => {
  it('renders one h1, the eyebrow and the hue/area hooks; the decoration is hidden from assistive tech', () => {
    render(
      <PageHead
        hue="moss"
        hue2="lime"
        area="plan"
        icon="check"
        eyebrow="Einstellungen · Module"
        title="ToDos"
        titleId="module-todos"
        description="Aufgaben"
        decoration={<span data-testid="mark">x</span>}
        testId="head"
      />,
    );
    const head = screen.getByTestId('head');
    expect(head).toHaveAttribute('data-hue', 'moss');
    expect(head).toHaveAttribute('data-area', 'plan');
    expect(head.style.getPropertyValue('--module-color-2')).toBe('var(--mod-lime)');
    const h1 = screen.getByRole('heading', { level: 1, name: 'ToDos' });
    expect(h1).toHaveAttribute('id', 'module-todos');
    expect(screen.getByText('Einstellungen · Module')).toBeInTheDocument();
    expect(screen.getByTestId('mark').closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('carries children (tiles) under the title', () => {
    render(
      <PageHead hue="slate" area="system" icon="settings" eyebrow="E" title="T" size="tall">
        <p>tiles</p>
      </PageHead>,
    );
    expect(screen.getByText('tiles')).toBeInTheDocument();
  });
});
