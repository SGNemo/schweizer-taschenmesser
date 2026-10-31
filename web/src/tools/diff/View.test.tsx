// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const copy = vi.hoisted(() => vi.fn<(text: string) => Promise<boolean>>(async () => true));
vi.mock('../shared', async (orig) => ({ ...(await orig<object>()), copyText: copy }));

import DiffTool from './View';
import { MAX_CHARS } from './logic';

afterEach(cleanup);

const type = (id: string, value: string) =>
  fireEvent.change(screen.getByTestId(id), { target: { value } });

describe('DiffTool', () => {
  it('asks for text first', () => {
    render(<DiffTool />);
    expect(screen.queryByTestId('diff-count')).toBeNull();
  });

  it('counts changed lines and marks added and removed rows with text, not only colour', () => {
    render(<DiffTool />);
    type('diff-before', 'a\nb\nc');
    type('diff-after', 'a\nB\nc');
    expect(screen.getByTestId('diff-count')).toHaveTextContent('1 Zeile geändert');
    const kinds = [...screen.getByTestId('diff-rows').children].map((li) => li.textContent);
    expect(kinds[1]).toContain('entfernt');
    expect(kinds[2]).toContain('hinzugefügt');
  });

  it('says so when nothing differs and offers no copy button', () => {
    render(<DiffTool />);
    type('diff-before', 'same');
    type('diff-after', 'same');
    expect(screen.getByTestId('diff-count')).toHaveTextContent('Kein Unterschied.');
    expect(screen.queryByRole('button', { name: 'Als Unified Diff kopieren' })).toBeNull();
  });

  it('copies a unified diff', async () => {
    render(<DiffTool />);
    type('diff-before', 'a');
    type('diff-after', 'b');
    fireEvent.click(screen.getByRole('button', { name: 'Als Unified Diff kopieren' }));
    await vi.waitFor(() => expect(copy).toHaveBeenCalled());
    expect(copy.mock.calls[0]![0]).toContain('@@ -1,1 +1,1 @@\n-a\n+b');
  });

  it('can ignore whitespace', () => {
    render(<DiffTool />);
    type('diff-before', 'a  b');
    type('diff-after', 'a b');
    expect(screen.getByTestId('diff-count')).toHaveTextContent('1 Zeile geändert');
    fireEvent.click(screen.getByLabelText('Leerraum ignorieren'));
    expect(screen.getByTestId('diff-count')).toHaveTextContent('Kein Unterschied.');
  });

  it('shows a notice instead of computing a too long input', () => {
    render(<DiffTool />);
    type('diff-before', 'x'.repeat(MAX_CHARS + 1));
    expect(screen.getByTestId('diff-too-long')).toBeInTheDocument();
    expect(screen.queryByTestId('diff-rows')).toBeNull();
  });
});
