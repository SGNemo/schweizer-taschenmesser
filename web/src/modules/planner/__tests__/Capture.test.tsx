// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Capture } from '../components/Capture';
import type { FieldKind } from '../fieldKind';

// Planner hub 2, package 3: the preview line K1 in the field (hand-off 03). Invented lines.
const invoice: FieldKind = {
  kind: 'invoice',
  fields: { title: 'Stadtwerke', amountMinor: 8000, date: '2026-12-04' },
  deadline: '2026-12-04',
};

function field(props: Partial<Parameters<typeof Capture>[0]> = {}) {
  return render(
    <Capture
      value="Rechnung Stadtwerke 80 € bis Fr"
      onChange={() => undefined}
      onSubmit={(e) => e.preventDefault()}
      reading={false}
      {...props}
    />,
  );
}

afterEach(() => vi.useRealTimers());

describe('Capture – the preview line', () => {
  it('examples and the line never show together', () => {
    const { rerender } = field();
    expect(screen.getByRole('group', { name: 'Zum Beispiel' })).toBeTruthy();
    expect(screen.queryByTestId('planner-kind')).toBeNull();
    rerender(
      <Capture
        value="x"
        onChange={() => undefined}
        onSubmit={() => undefined}
        reading={false}
        preview={invoice}
        onAsTask={() => undefined}
      />,
    );
    expect(screen.getByTestId('planner-kind').textContent).toMatch(
      // The amount through `SensitiveValue` (hidden here: „Werte ausblenden“ is on by default in tests).
      /^Wird:\s*Rechnung · Stadtwerke · (80,00\s€|•+) · Frist Fr\.? 4\. Dez/,
    );
    expect(screen.queryByRole('group', { name: 'Zum Beispiel' })).toBeNull();
  });

  it('K3 and Alt+Enter make it a task; plain Enter submits as before', () => {
    const onAsTask = vi.fn();
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    field({ preview: invoice, onAsTask, onSubmit });
    fireEvent.click(screen.getByRole('button', { name: 'Als Aufgabe eintragen' }));
    expect(onAsTask).toHaveBeenCalledTimes(1);
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Enter', altKey: true });
    expect(onAsTask).toHaveBeenCalledTimes(2);
    fireEvent.submit(input.closest('form')!);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('the phone: the line stands above the field', () => {
    field({ preview: invoice, onAsTask: () => undefined, previewAbove: true });
    const line = screen.getByTestId('planner-kind');
    const input = screen.getByRole('textbox');
    expect(line.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('the live region speaks once the kind stood still for 400 ms, never per keystroke', () => {
    vi.useFakeTimers();
    const { rerender } = field({ preview: invoice, onAsTask: () => undefined });
    const said = () => screen.getByTestId('planner-kind-said').textContent;
    expect(said()).toBe('');
    act(() => vi.advanceTimersByTime(200));
    // Another keystroke, the same kind: the timer does not start over with a new sentence each time.
    rerender(
      <Capture
        value="Rechnung Stadtwerke 81 €"
        onChange={() => undefined}
        onSubmit={() => undefined}
        reading={false}
        preview={{ ...invoice, fields: { ...invoice.fields, amountMinor: 8100 } }}
        onAsTask={() => undefined}
      />,
    );
    act(() => vi.advanceTimersByTime(399));
    expect(said()).toBe('');
    act(() => vi.advanceTimersByTime(1));
    expect(said()).toMatch(/^Wird: Rechnung · Stadtwerke · Frist/);
    // No amount is spoken.
    expect(said()).not.toMatch(/€/);
  });

  it('a lead chip is struck through with A7 while the line shows a kind that takes none', () => {
    field({
      preview: invoice,
      onAsTask: () => undefined,
      lead: [{ id: 'a2', label: 'vor Friseur, Mi' }],
    });
    const chip = screen.getByText('vor Friseur, Mi', { selector: 'span' });
    const desc = document.getElementById(chip.getAttribute('aria-describedby')!);
    expect(desc?.textContent).toBe('vor Friseur, Mi – gilt nicht für Rechnung');
  });
});
