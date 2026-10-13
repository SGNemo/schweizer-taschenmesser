// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearErrorLog, errorLog } from '@/core/diagnostics/errorLog';
import { WidgetErrorBoundary } from './WidgetErrorBoundary';

let broken = true;
const Bomb = () => {
  if (broken) throw new Error('kaputt');
  return <p>Widget ok</p>;
};
afterEach(() => {
  broken = true;
  clearErrorLog();
  vi.restoreAllMocks();
});

describe('WidgetErrorBoundary', () => {
  it('keeps neighbours alive, logs the widget and recovers on retry', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <>
        <WidgetErrorBoundary id="todos:open">
          <Bomb />
        </WidgetErrorBoundary>
        <p>Nachbar</p>
      </>,
    );
    expect(screen.getByTestId('widget-error')).toBeInTheDocument();
    expect(screen.getByText('Nachbar')).toBeInTheDocument();
    expect(errorLog().at(-1)?.source).toBe('widget-todos:open');
    broken = false;
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(screen.getByText('Widget ok')).toBeInTheDocument();
  });
});
