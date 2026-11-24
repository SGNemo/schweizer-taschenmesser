// @vitest-environment jsdom
/** The mark „Im Plan · Mi“ (hand-off 10): the states M1–M5, the name M6, nothing while off, loading or not planned. */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { PlanMark, PlanMarkLink } from './PlanMark';

const NOW = new Date(2026, 10, 30, 10, 0).getTime(); // Monday 2026-11-30
const stamp = { createdAt: 1, updatedAt: 1, deviceId: 't', deletedAt: null, _f: {} };

const plannerOn = (enabled: boolean) =>
  db.table('_modules').put({ id: 'planner', enabled, dataPolicy: null, ...stamp });
const place = (itemKey: string, date: string, locked?: boolean) =>
  db.table('planner_assignment').put({
    id: `${itemKey}#0`,
    itemKey,
    k: 0,
    of: 1,
    date,
    minutes: 30,
    order: 0,
    reason: 'new',
    ...(locked ? { locked } : {}),
    ...stamp,
  });
const draw = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);

beforeEach(async () => {
  setNow(() => NOW);
  for (const t of ['planner_assignment', 'planner_item', '_modules', '_links'])
    await db.table(t).clear();
  await plannerOn(true);
});
afterEach(() => {
  cleanup();
  setNow();
});

describe('PlanMarkLink (the states as drawn)', () => {
  it('M1 – one link with the planner glyph, the visible words first in its name', () => {
    draw(
      <PlanMarkLink
        state={{ kind: 'day', date: '2026-12-02', locked: false, rowKey: 'invoices:i1' }}
      />,
    );
    const mark = screen.getByRole('link');
    expect(mark).toHaveTextContent('Im Plan · Mi');
    expect(mark).toHaveAccessibleName('Im Plan · Mi – Mittwoch, 2. Dezember. Im Planer zeigen');
    expect(mark).toHaveAttribute('href', '/planner?day=2026-12-02&item=invoices%3Ai1');
    expect(mark.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('M2 „fest“, M3 „noch ohne Tag“, M4 „war Mo“ (plain, never a tone), M5 the pile (prop, from package 2)', () => {
    const { rerender } = draw(
      <PlanMarkLink state={{ kind: 'day', date: '2026-12-02', locked: true, rowKey: 'x:1' }} />,
    );
    expect(screen.getByRole('link')).toHaveTextContent('Im Plan · Mi · fest');
    const again = (node: React.ReactNode) => rerender(<MemoryRouter>{node}</MemoryRouter>);
    again(<PlanMarkLink state={{ kind: 'noDay', rowKey: 'lists:l1' }} />);
    expect(screen.getByRole('link')).toHaveTextContent('Im Plan · noch ohne Tag');
    expect(screen.getByRole('link')).toHaveAccessibleName(
      'Im Plan · noch ohne Tag. Im Planer zeigen',
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', '/planner?item=lists%3Al1');
    again(<PlanMarkLink state={{ kind: 'passed', date: '2026-11-23', rowKey: 'x:1' }} />);
    expect(screen.getByRole('link')).toHaveTextContent('Im Plan · war Mo');
    expect(screen.getByRole('link')).toHaveAttribute('href', '/planner?tab=open&item=x%3A1');
    again(
      <PlanMarkLink
        state={{
          kind: 'day',
          date: '2026-12-02',
          locked: false,
          rowKey: 'planner:pile-money',
          pile: 'Finanzen checken',
        }}
      />,
    );
    expect(screen.getByRole('link')).toHaveTextContent('Im Plan · Mi · in „Finanzen checken“');
  });

  it('not in the plan, or still loading: nothing', () => {
    const { container } = draw(
      <>
        <PlanMarkLink state={null} />
        <PlanMarkLink state={undefined} />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('the detail variant is its own line', () => {
    draw(<PlanMarkLink state={{ kind: 'noDay', rowKey: 'x:1' }} variant="detail" />);
    expect(screen.getByRole('link').className).toMatch(/detail/);
  });
});

describe('PlanMark (live)', () => {
  it('reads the planner: a subscription placed from the planner shows M1 on its occurrence row', async () => {
    await place('subscriptions:s1:2026-12-03', '2026-12-02');
    draw(<PlanMark module="subscriptions" id="s1" />);
    const mark = await screen.findByRole('link');
    expect(mark).toHaveTextContent('Im Plan · Mi');
    expect(mark).toHaveAttribute(
      'href',
      '/planner?day=2026-12-02&item=subscriptions%3As1%3A2026-12-03',
    );
  });

  it('nothing while the planner is off, whatever is stored; nothing for a done thing', async () => {
    await place('invoices:i1', '2026-12-02');
    await plannerOn(false);
    const { container, unmount } = draw(<PlanMark module="invoices" id="i1" fallback />);
    await new Promise((r) => setTimeout(r, 50));
    expect(container).toBeEmptyDOMElement();
    unmount();
    await plannerOn(true);
    const done = draw(<PlanMark module="invoices" id="i1" done />);
    await new Promise((r) => setTimeout(r, 50));
    expect(done.container).toBeEmptyDOMElement();
  });

  it('the fallback (the module’s own field) reads M3 while the planner has no row', async () => {
    draw(<PlanMark module="bookmarks" id="bm1" fallback />);
    await waitFor(() =>
      expect(screen.getByRole('link')).toHaveTextContent('Im Plan · noch ohne Tag'),
    );
  });
});
