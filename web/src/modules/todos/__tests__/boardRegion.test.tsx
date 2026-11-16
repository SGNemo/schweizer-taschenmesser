// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { t } from '@/strings';
import { BoardView } from '../components/BoardView';

afterEach(cleanup);

describe('ToDos board (H16)', () => {
  it('its sideways scroll area is a named region the keyboard can reach (axe scrollable-region-focusable)', () => {
    render(
      <BoardView
        tasks={[]}
        day="2026-11-16"
        onOpen={() => {}}
        onMove={() => {}}
        onTomorrow={() => {}}
      />,
    );
    const board = screen.getByRole('region', { name: t.todos.board.label });
    expect(board).toBe(screen.getByTestId('todos-board'));
    expect(board.getAttribute('tabindex')).toBe('0');
  });
});
