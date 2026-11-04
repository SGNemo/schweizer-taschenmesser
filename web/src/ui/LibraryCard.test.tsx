// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HuePlate } from './HuePlate';
import { LibraryCard } from './LibraryCard';

describe('HuePlate', () => {
  it('carries the hue and hides itself from assistive tech', () => {
    const { container } = render(<HuePlate hue="teal" icon="check" size="lg" />);
    const plate = container.firstElementChild!;
    expect(plate.getAttribute('data-hue')).toBe('teal');
    expect(plate.getAttribute('data-size')).toBe('lg');
    expect(plate.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('LibraryCard', () => {
  it('with a hue: data-hue on the card and the solid plate', () => {
    render(
      <ul>
        <LibraryCard id="a" testId="card" icon="check" name="A" description="d" hue="ocean" />
      </ul>,
    );
    const card = screen.getByTestId('card');
    expect(card.getAttribute('data-hue')).toBe('ocean');
    expect(card.querySelector('[data-size="lg"][data-hue="ocean"]')).not.toBeNull();
  });

  it('without a hue: unchanged, no data-hue and no plate', () => {
    render(
      <ul>
        <LibraryCard id="b" testId="card" icon="check" name="B" description="d" />
      </ul>,
    );
    const card = screen.getByTestId('card');
    expect(card.hasAttribute('data-hue')).toBe(false);
    expect(card.querySelector('[data-size]')).toBeNull();
  });
});
