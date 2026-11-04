// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WIDGET_VARIANTS } from '@/core/modules/types';
import { WidgetMiniature } from './WidgetMiniature';

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
});
