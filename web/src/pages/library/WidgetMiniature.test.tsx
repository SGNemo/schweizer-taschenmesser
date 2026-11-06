// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WIDGET_VARIANTS } from '@/core/modules/types';
import { progressForm, WidgetMiniature } from './WidgetMiniature';

describe('WidgetMiniature', () => {
  it.each(WIDGET_VARIANTS)('draws the %s shape: decoration only, no text', (variant) => {
    const { container } = render(<WidgetMiniature variant={variant} />);
    const mini = screen.getByTestId('widget-miniature');
    expect(mini).toHaveAttribute('data-variant', variant);
    expect(mini).toHaveAttribute('aria-hidden', 'true');
    // a sketch has shapes inside and never any text or number
    expect(mini.children.length).toBeGreaterThan(0);
    expect(container.textContent).toBe('');
  });

  it('draws fortschritt as rings for ring signatures and as bars for the rest (N06)', () => {
    expect(progressForm('ring')).toBe('rings');
    expect(progressForm('gauges')).toBe('rings');
    expect(progressForm('weekBars')).toBe('bars');
    expect(progressForm('envelope')).toBe('bars');
    const { rerender } = render(<WidgetMiniature variant="fortschritt" signature="weekBars" />);
    expect(screen.getByTestId('widget-miniature')).toHaveAttribute('data-form', 'bars');
    rerender(<WidgetMiniature variant="fortschritt" signature="ring" />);
    expect(screen.getByTestId('widget-miniature')).toHaveAttribute('data-form', 'rings');
  });
});
