// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubNav } from './SubNav';
import { useOverflowMark } from './useOverflowMark';

const items = [
  { id: 'a', label: 'Aufgaben', to: '/todos', active: true, icon: 'check' as const },
  { id: 'b', label: 'Kalender', to: '/calendar', active: false, icon: 'calendar' as const },
];

function widths(scroll: number, client: number) {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(scroll);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(client);
  // jsdom has no scrolling; the row scrolls its active pill into view when it overflows.
  HTMLElement.prototype.scrollTo = () => undefined;
}

afterEach(() => vi.restoreAllMocks());

describe('row-end fade only on overflow', () => {
  it('the module row marks whether it overflows', () => {
    widths(300, 300);
    const fits = render(
      <MemoryRouter>
        <SubNav label="Bereich" items={items} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('subnav')).toHaveAttribute('data-overflow', 'false');
    fits.unmount();
    widths(600, 300);
    render(
      <MemoryRouter>
        <SubNav label="Bereich" items={items} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('subnav')).toHaveAttribute('data-overflow', 'true');
  });

  // The calendar's chips mount after the row (a live query): a child added later must mark the row again.
  it('marks again when a child is added after mount', async () => {
    let addChip = () => undefined as void;
    function Row() {
      const ref = useRef<HTMLDivElement>(null);
      const [chips, setChips] = useState(false);
      addChip = () => setChips(true);
      useOverflowMark(ref, 'fixed');
      return (
        <div ref={ref} data-testid="row">
          <span>Monat</span>
          {chips ? <span>Arbeit</span> : null}
        </div>
      );
    }
    widths(300, 300);
    render(<Row />);
    expect(screen.getByTestId('row')).toHaveAttribute('data-overflow', 'false');
    widths(600, 300);
    await act(async () => addChip());
    expect(screen.getByTestId('row')).toHaveAttribute('data-overflow', 'true');
  });

  // The style sheets draw the fade only under `[data-overflow='true']`: a row that fits keeps its last entry clear.
  it.each([
    ['ui/SubNav.module.css', '.subnav'],
    ['modules/calendar/routes/calendar.module.css', '.viewRow'],
  ])('%s fades %s only while it overflows', (file, cls) => {
    const css = readFileSync(join(__dirname, '..', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const fading = [...css.matchAll(/([^{}]+)\{[^{}]*mask-image:\s*linear-gradient/g)].map((m) =>
      m[1]!.trim(),
    );
    const own = fading.filter((s) => s.startsWith(cls));
    expect(own.length).toBeGreaterThan(0);
    for (const selector of own) expect(selector).toContain("[data-overflow='true']");
  });

  it('the to-do page draws no standing row-end fade (its old chip row was never rendered)', () => {
    const css = readFileSync(join(__dirname, '../modules/todos/routes/todos.module.css'), 'utf8');
    expect(css).not.toMatch(/mask-image:\s*linear-gradient/);
  });
});
