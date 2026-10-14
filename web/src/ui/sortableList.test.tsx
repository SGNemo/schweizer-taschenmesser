// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { t } from '@/strings';
import { moveId, SortableList } from './SortableList';

describe('moveId', () => {
  it('moves an id to the position of another', () => {
    expect(moveId(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a']);
    expect(moveId(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
  });
  it('ignores unknown ids and no-ops', () => {
    expect(moveId(['a', 'b'], 'x', 'a')).toEqual(['a', 'b']);
    expect(moveId(['a', 'b'], 'a', 'a')).toEqual(['a', 'b']);
  });
});

describe('SortableList', () => {
  it('renders a named handle per row', () => {
    render(
      <SortableList
        items={[{ id: 'a' }, { id: 'b' }]}
        getId={(i) => i.id}
        getLabel={(i) => `Item ${i.id}`}
        onReorder={vi.fn()}
        renderItem={(i, _n, handle) => (
          <div>
            {i.id}
            {handle}
          </div>
        )}
      />,
    );
    expect(screen.getByRole('button', { name: t.homeEdit.handle('Item a') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.homeEdit.handle('Item b') })).toBeInTheDocument();
  });
});
