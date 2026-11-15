// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ItemList, ItemRow, Progress } from './Patterns';

const menu = [{ id: 'a', label: 'Später', onSelect: () => undefined }];

describe('ItemRow: additive states (planner hub R1)', () => {
  it('controls: the default keeps the actions for hover and focus, `always` shows them at rest', () => {
    render(
      <ItemList>
        <ItemRow title="A" menu={menu} menuLabel="Aktionen für A" />
        <ItemRow title="B" menu={menu} menuLabel="Aktionen für B" controls="always" />
      </ItemList>,
    );
    const actions = document.querySelectorAll('[data-row-actions]');
    expect(actions[0]!.className).not.toMatch(/actionsAlways/);
    expect(actions[1]!.className).toMatch(/actionsAlways/);
    // Both menus are real buttons either way: the prop is about sight, not about reach.
    expect(screen.getByRole('button', { name: 'Aktionen für A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aktionen für B' })).toBeInTheDocument();
  });

  it('weight and recessed mark the list item; a plain row carries neither', () => {
    render(
      <ItemList>
        <ItemRow title="Plain" />
        <ItemRow title="Next" weight="next" />
        <ItemRow title="Block" recessed />
      </ItemList>,
    );
    const [plain, next, block] = screen.getAllByRole('listitem');
    expect(plain!.className).not.toMatch(/next|recessed/);
    expect(next!.className).toMatch(/next/);
    expect(block!.className).toMatch(/recessed/);
  });
});

describe('Progress: additive states (planner hub R1)', () => {
  it('unchanged by default: full width, `over` paints the danger bar, no value text', () => {
    render(<Progress value={5} max={4} label="Last" over />);
    const bar = screen.getByRole('progressbar', { name: 'Last' });
    expect(bar.style.width).toBe('');
    expect(bar.className).not.toMatch(/progressOutline/);
    expect(bar).not.toHaveAttribute('aria-valuetext');
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    expect(bar.firstElementChild!.className).toMatch(/progressOver/);
  });

  it('`over="hatch"` keeps the hue and hatches; scale, outline and the value text are set', () => {
    render(
      <Progress
        value={5}
        max={4}
        label="Last"
        over="hatch"
        scale={0.5}
        outline
        valueText="40 Min mehr als planbar"
      />,
    );
    const bar = screen.getByRole('progressbar', { name: 'Last' });
    expect(bar.style.width).toBe('50%');
    expect(bar.className).toMatch(/progressOutline/);
    expect(bar).toHaveAttribute('aria-valuetext', '40 Min mehr als planbar');
    expect(bar.firstElementChild!.className).toMatch(/progressHatch/);
    expect(bar.firstElementChild!.className).not.toMatch(/progressOver/);
  });

  it('scale is clamped to 0–1', () => {
    render(<Progress value={1} max={4} label="Last" scale={3} />);
    expect(screen.getByRole('progressbar').style.width).toBe('100%');
  });
});
