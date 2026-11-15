// @vitest-environment jsdom
/**
 * The thing row's lead slot, chip line and ⋯ (planner hub K1b, CONCEPT-DESIGN §4, CONCEPT-LINKS §1.4, L7): a tick
 * where the source ticks, the source's action as a route otherwise, the icon only where nothing acts; at most two
 * chips, the rest under „Verknüpft“; alive leads in the app, gone says so, elsewhere opens only on a tap.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlannableEntry } from '@/core/modules/contributions';
import type { ResolvedState } from '@/core/modules/types';
import { refKey, type EntityRef } from '@/core/entitylinks/types';
import type { BoardRow } from '../board';
import { linksOfEntry, linkWord, isAppRoute, withLinks } from '../components/RowLinks';
import { ThingRow } from '../components/ThingRow';

const states = new Map<string, ResolvedState | undefined>();
let loading = false;
const openUrl = vi.fn();

vi.mock('@/core/modules/contributions', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useResolvedLinks: (refs: readonly EntityRef[]) =>
    loading
      ? undefined
      : new Map(refs.map((r) => [refKey(r), states.get(refKey(r)) ?? { state: 'gone' }])),
}));
vi.mock('@/core/platform', async (orig) => {
  const real = await orig<{ getPlatform: () => { app: object } }>();
  return {
    ...real,
    getPlatform: () => ({ ...real.getPlatform(), app: { ...real.getPlatform().app, openUrl } }),
  };
});

const invoice: PlannableEntry = {
  moduleId: 'invoices',
  id: 'inv-1',
  kind: 'invoice',
  title: 'Stadtwerke Musterstadt bezahlen',
  to: '/invoices?open=inv-1',
  durationMin: 10,
  action: { label: 'Bezahlt …', to: '/invoices?open=inv-1&do=pay' },
  links: [
    { to: { module: 'mail', id: 'th-origin' }, rel: 'origin', label: 'Rechnung November' },
    { to: { module: 'mail', id: 'th-dun' }, rel: 'dunning', label: 'Mahnung', on: '2026-11-03' },
    { to: { module: 'notes', id: 'n1' }, rel: 'about', label: 'Zählerstand' },
  ],
};

const row = (entry: PlannableEntry | undefined, title = entry?.title ?? 'Ding'): BoardRow => ({
  unitId: `${entry?.moduleId}:${entry?.id}#0`,
  itemKey: `${entry?.moduleId}:${entry?.id}`,
  title,
  minutes: 10,
  k: 0,
  of: 1,
  reason: 'new',
  approx: false,
  pinned: false,
  ...(entry ? { entry } : {}),
});

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname + loc.search}</p>;
}

function draw(r: BoardRow, opts: { onDone?: () => Promise<boolean> } = {}) {
  return render(
    <MemoryRouter initialEntries={['/planner']}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <ul>
                <ThingRow
                  row={r}
                  reason=""
                  whyOpen={false}
                  dueClock={0}
                  menu={[
                    { id: 'move', label: 'Verschieben …', onSelect: () => undefined },
                    { id: 'open', label: 'Öffnen', group: 'Mehr', onSelect: () => undefined },
                  ]}
                  {...(opts.onDone ? { onDone: opts.onDone } : {})}
                />
              </ul>
              <Where />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  states.clear();
  loading = false;
  openUrl.mockReset();
});

describe('lead slot', () => {
  it('a source that ticks keeps the tick; its action and icon stay out of the slot', () => {
    draw(row({ ...invoice, links: [] }, 'Saugen'), { onDone: async () => true });
    expect(screen.getByRole('checkbox', { name: 'Erledigt: Saugen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Bezahlt/ })).toBeNull();
  });

  it('a money row leads with its action: a route to the pay step, its word in the name and as first ⋯ entry', () => {
    draw(row({ ...invoice, links: [] }));
    const lead = screen.getByRole('button', { name: 'Bezahlt …: Stadtwerke Musterstadt bezahlen' });
    expect(lead).toHaveAttribute('title', 'Bezahlt …');
    expect(screen.queryByRole('checkbox')).toBeNull();
    fireEvent.click(lead);
    expect(screen.getByTestId('where')).toHaveTextContent('/invoices?open=inv-1&do=pay');
  });

  it('the action is the first ⋯ entry, then the day steps, then „Mehr“', async () => {
    draw(row({ ...invoice, links: [] }));
    fireEvent.click(screen.getByRole('button', { name: /^Aktionen für/ }));
    const items = (await screen.findAllByRole('menuitem')).map((m) => m.textContent);
    expect(items).toEqual(['Bezahlt …', 'Verschieben …', 'Öffnen']);
  });

  it('an external action is never followed', () => {
    draw(row({ ...invoice, links: [], action: { label: 'Bezahlt …', to: 'https://example.org' } }));
    fireEvent.click(screen.getByRole('button', { name: /^Bezahlt …:/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/planner');
  });

  it('without tick and action the slot shows the source icon, and the meta names the source once', () => {
    const { container } = draw(row({ ...invoice, links: [], action: undefined }));
    const li = container.querySelector('li')!;
    // One glyph for the source (in the lead), not two.
    const svgs = li.querySelectorAll('svg');
    const lead = li.firstElementChild!.firstElementChild!;
    expect(lead.querySelector('svg')).not.toBeNull();
    expect(svgs.length).toBe(2); // the lead's icon and the ⋯ glyph
    expect(li).toHaveTextContent('Rechnung');
  });
});

describe('chip line', () => {
  it('shows at most two chips, a reminder first; every link is in ⋯ under „Verknüpft · 3“', async () => {
    states.set('mail:th-dun', {
      state: 'alive',
      title: 'Mahnung Stadtwerke',
      to: '/mail?open=th-dun',
    });
    states.set('mail:th-origin', { state: 'alive', title: 'Rechnung', to: '/mail?open=th-origin' });
    states.set('notes:n1', { state: 'alive', title: 'Zählerstand', to: '/notes?open=n1' });
    draw(row(invoice));
    const line = screen.getByRole('group', { name: 'Verknüpft' });
    const chips = within(line).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual(['Zur Mahnung', 'Aus Mail']);
    expect(chips[0]).toHaveAccessibleName('Zur Mahnung: Mahnung Stadtwerke');
    fireEvent.click(screen.getByRole('button', { name: /^Aktionen für/ }));
    const menu = await screen.findByRole('menu');
    expect(menu).toHaveTextContent('Verknüpft · 3');
    const items = within(menu)
      .getAllByRole('menuitem')
      .map((m) => m.textContent);
    expect(items).toEqual([
      'Bezahlt …',
      'Verschieben …',
      'Zur Mahnung: Mahnung Stadtwerke',
      'Aus Mail: Rechnung',
      'Zur Notiz: Zählerstand',
      'Öffnen',
    ]);
  });

  it('an alive chip leads to the entity in one tap', () => {
    states.set('mail:th-dun', { state: 'alive', title: 'Mahnung', to: '/mail?open=th-dun' });
    draw(row(invoice));
    fireEvent.click(screen.getByRole('button', { name: /^Zur Mahnung/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/mail?open=th-dun');
  });

  it('a gone target says so, muted, without an action', () => {
    draw(row({ ...invoice, links: [invoice.links![1]!] }));
    const line = screen.getByRole('group', { name: 'Verknüpft' });
    expect(within(line).queryByRole('button')).toBeNull();
    expect(line).toHaveTextContent('Zur Mahnung · Gibt es nicht mehr.');
  });

  it('elsewhere with an address opens it only on a tap', () => {
    states.set('mail:th-dun', { state: 'elsewhere', url: 'https://mail.example.org/#th-dun' });
    draw(row({ ...invoice, links: [invoice.links![1]!] }));
    expect(openUrl).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Zur Mahnung: Mahnung · Im Browser öffnen' }),
    );
    expect(openUrl).toHaveBeenCalledWith('https://mail.example.org/#th-dun');
    expect(screen.getByTestId('where')).toHaveTextContent('/planner');
  });

  it('unavailable without an address: „Nicht auf diesem Gerät.“, no action', () => {
    states.set('mail:th-dun', { state: 'unavailable' });
    draw(row({ ...invoice, links: [invoice.links![1]!] }));
    const line = screen.getByRole('group', { name: 'Verknüpft' });
    expect(within(line).queryByRole('button')).toBeNull();
    expect(line).toHaveTextContent('Nicht auf diesem Gerät.');
  });

  it('while loading the chip is there but not usable (nothing jumps)', () => {
    loading = true;
    draw(row({ ...invoice, links: [invoice.links![1]!] }));
    expect(screen.getByRole('button', { name: 'Zur Mahnung: Mahnung' })).toBeDisabled();
  });

  it('reads the deprecated `link` as the only link', () => {
    states.set('notes:n9', { state: 'alive', title: 'Vermieter', to: '/notes?open=n9' });
    const todo: PlannableEntry = {
      moduleId: 'todos',
      id: 't1',
      kind: 'task',
      title: 'Vermieter antworten',
      to: '/todos?open=t1',
      link: { kind: 'note', id: 'n9', label: 'Vermieter' },
    };
    draw(row(todo), { onDone: async () => true });
    expect(screen.getByRole('button', { name: 'Zur Notiz: Vermieter' })).toBeInTheDocument();
  });
});

describe('helpers', () => {
  it('one chip per target, reminder first', () => {
    const dup = { ...invoice, links: [...invoice.links!, invoice.links![0]!] };
    expect(linksOfEntry(dup).map((l) => refKey(l.to))).toEqual([
      'mail:th-dun',
      'mail:th-origin',
      'notes:n1',
    ]);
  });

  it('chip words', () => {
    expect(linkWord({ to: { module: 'invoices', id: 'x' }, rel: 'about', label: '' })).toBe(
      'Zur Rechnung',
    );
    expect(linkWord({ to: { module: 'mail', id: 'x' }, rel: 'about', label: '' })).toBe('Zur Mail');
  });

  it('only in-app routes', () => {
    expect(isAppRoute('/invoices?open=1')).toBe(true);
    expect(isAppRoute('//evil.example')).toBe(false);
    expect(isAppRoute('https://evil.example')).toBe(false);
  });

  it('menu order: action, day steps, links, „Mehr“', () => {
    const f = (id: string, group?: string) => ({
      id,
      label: id,
      onSelect: () => undefined,
      ...(group ? { group } : {}),
    });
    expect(
      withLinks([f('move'), f('open', 'Mehr')], [f('action')], [f('l1', 'Verknüpft')]).map(
        (i) => i.id,
      ),
    ).toEqual(['action', 'move', 'l1', 'open']);
  });
});
