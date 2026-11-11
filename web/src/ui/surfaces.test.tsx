// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GroupedList } from './GroupedList';
import { ListSurface } from './ListSurface';
import { ItemList, ItemRow } from './Patterns';
import { Tabs } from './Tabs';

/**
 * Building blocks of Identity 4.0, package 0b-1 (docs/design/ui-audit-2026-11/PACKAGES.md): depth by tone steps.
 * jsdom applies no stylesheet, so what a surface looks like is read from its CSS source.
 */
const css = (name: string): string =>
  readFileSync(resolve(__dirname, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
/** The declarations of the first rule whose selector is exactly `selector`. */
const rule = (source: string, selector: string): string => {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|\\})\\s*${esc}\\s*\\{([^}]*)\\}`).exec(source);
  if (!m) throw new Error(`rule not found: ${selector}`);
  return m[1]!;
};

describe('Card', () => {
  it('is a raised tone step: no shadow, no border', () => {
    const card = rule(css('Card.module.css'), '.card');
    expect(card).toMatch(/background:\s*var\(--surface-raised\)/);
    expect(card).not.toMatch(/box-shadow|border(?!-radius)/);
  });
});

describe('ListSurface', () => {
  it('is a raised tone step with hairlines between the rows only', () => {
    const source = css('ListSurface.module.css');
    const surface = rule(source, '.surface');
    expect(surface).toMatch(/background:\s*var\(--surface-raised\)/);
    expect(surface).not.toMatch(/box-shadow|border(?!-radius)/);
    expect(rule(source, '.surface > * + *')).toMatch(/border-top:\s*1px solid var\(--border\)/);
    // Nothing else in the file draws a line: no frame around the surface, none above the first row.
    expect(source.match(/border(?!-radius)[\w-]*\s*:/g)).toHaveLength(1);
  });

  it('renders a list with its accessible name; other elements on request', () => {
    const { rerender } = render(
      <ListSurface label="Buchungen">
        <li>Miete</li>
      </ListSurface>,
    );
    const list = screen.getByRole('list', { name: 'Buchungen' });
    expect(list.tagName).toBe('UL');
    expect(list).toHaveAttribute('data-list-surface');
    rerender(
      <ListSurface as="ol" label="Rangliste">
        <li>Eins</li>
      </ListSurface>,
    );
    expect(screen.getByRole('list', { name: 'Rangliste' }).tagName).toBe('OL');
  });

  it('is the surface of ItemList, and so of the rows of a GroupedList group: it does not replace the grouping', () => {
    render(
      <GroupedList
        listId="t"
        label="ToDos"
        groups={[
          {
            id: 'today',
            label: 'Heute',
            count: 1,
            children: (
              <ItemList label="Heute">
                <ItemRow title="Müll rausbringen" />
              </ItemList>
            ),
          },
        ]}
      />,
    );
    const group = screen.getByRole('group', { name: 'ToDos' });
    const surface = group.querySelector('[data-list-surface]');
    expect(surface).not.toBeNull();
    expect(surface).toContainElement(screen.getByText('Müll rausbringen'));
    // The group header stays outside the surface: the surface holds rows, the group holds the surface.
    expect(surface).not.toContainElement(screen.getByRole('button', { name: /Heute/ }));
  });

  it('ItemList keeps the padding of the surface, whatever the order of the two stylesheets', () => {
    // `.list` resets padding for the grid; `.rows` (same element as `.surface`) must restate the surface's own.
    const padding = /padding:\s*([^;]+);/.exec(rule(css('ListSurface.module.css'), '.surface'))![1];
    const rows = rule(css('Patterns.module.css'), '.rows');
    expect(/padding:\s*([^;]+);/.exec(rows)?.[1]).toBe(padding);
  });

  it('ItemList tiles (grid) are raised tone steps too, without a shadow', () => {
    const patterns = css('Patterns.module.css');
    expect(patterns).toMatch(/\.grid > \.item \{[^}]*background:\s*var\(--surface-raised\)/);
    expect(patterns).not.toMatch(/\.grid > \.item \{[^}]*box-shadow/);
    render(
      <ItemList layout="grid" label="Kacheln">
        <ItemRow title="Eins" />
      </ItemList>,
    );
    expect(screen.getByRole('list', { name: 'Kacheln' })).not.toHaveAttribute('data-list-surface');
  });
});

describe('Segmented', () => {
  it('is a sunken track with the chosen option raised out of it: no shadow', () => {
    const patterns = css('Patterns.module.css');
    expect(rule(patterns, '.segment')).toMatch(/background:\s*var\(--surface-sunken\)/);
    const on = rule(patterns, ".segment button[aria-pressed='true']");
    expect(on).toMatch(/background:\s*var\(--surface-raised\)/);
    expect(on).not.toMatch(/box-shadow/);
  });
});

describe('Tabs', () => {
  it('takes the shape of Segmented (value, options, onChange), so the views of a page move over as they are', async () => {
    const onChange = vi.fn();
    render(
      <Tabs
        label="Ansicht"
        value="week"
        onChange={onChange}
        options={[
          { value: 'month', label: 'Monat' },
          { value: 'week', label: 'Woche' },
        ]}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Ansicht' });
    expect(nav).toBeVisible();
    expect(screen.getByRole('button', { name: 'Woche' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Monat' })).not.toHaveAttribute('aria-current');
    await userEvent.click(screen.getByRole('button', { name: 'Monat' }));
    expect(onChange).toHaveBeenCalledWith('month');
  });

  it('still takes items with links or buttons', async () => {
    const onSelect = vi.fn();
    render(
      <Tabs
        label="Reiter"
        onSelect={onSelect}
        items={[
          { id: 'a', label: 'A', active: true },
          { id: 'b', label: 'B', active: false },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'B' }));
    expect(onSelect).toHaveBeenCalledWith('b');
  });
});

describe('shadows in ui/ (Identity 4.0: only floating things cast one)', () => {
  // The stylesheets of `ui/` that may still write `--shadow-1`, with what casts it. A file that is not listed here
  // must not use it; an entry goes when its package removes the shadow (the head went with 0b-2; signature blocks
  // and widget bodies: the area packages and 0b-7).
  const ALLOWED: Record<string, string> = {
    'Fields.module.css': 'switch thumb (lies on its track)',
    'SelectionBar.module.css': 'sticky selection bar (floats over the list)',
    'identity/BankCard.module.css': 'signature block',
    'identity/CalendarLeaf.module.css': 'signature block',
    'identity/Sky.module.css': 'signature block',
    'identity/blocks.module.css': 'signature blocks',
    'widgets/Bodies.module.css': 'widget body "notiz" (package 0b-7)',
  };
  it('no other stylesheet of ui/ uses --shadow-1', () => {
    const files = (readdirSync(__dirname, { recursive: true }) as string[])
      .map((f) => f.split('\\').join('/'))
      .filter((f) => f.endsWith('.module.css'));
    const using = files.filter((f) => /var\(--shadow-1\)/.test(css(f))).sort();
    expect(using).toEqual(Object.keys(ALLOWED).sort());
  });
});
