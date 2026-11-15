// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { WidgetBody } from './WidgetBody';

describe('WidgetBody', () => {
  it('marks the empty state with data-empty (U39) and leaves content and loading unmarked', () => {
    const { container, rerender } = render(
      <MemoryRouter>
        <WidgetBody loading={false} isEmpty empty="Nichts fällig">
          <p>Inhalt</p>
        </WidgetBody>
      </MemoryRouter>,
    );
    expect(screen.getByText('Nichts fällig')).toBeInTheDocument();
    expect(container.querySelector('[data-empty]')).not.toBeNull();
    rerender(
      <MemoryRouter>
        <WidgetBody loading={false} isEmpty={false} empty="Nichts fällig">
          <p>Inhalt</p>
        </WidgetBody>
      </MemoryRouter>,
    );
    expect(screen.getByText('Inhalt')).toBeInTheDocument();
    expect(container.querySelector('[data-empty]')).toBeNull();
    rerender(
      <MemoryRouter>
        <WidgetBody loading isEmpty empty="Nichts fällig">
          <p>Inhalt</p>
        </WidgetBody>
      </MemoryRouter>,
    );
    expect(container.querySelector('[data-empty]')).toBeNull();
  });
});
