// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import type { Stored } from '@/core/db/types';
import { enableModule } from '@/core/modules/activation';
import { getManifest, validateManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { bookmarkMenu } from '../components/BookmarkRow';
import { isWeekendNear, pickNext, planMinutesOf } from '../logic';
import manifest from '../manifest';
import source from '../plannable';
import { itemRepo } from '../repo';
import { itemSchema, type BookmarkItem } from '../schema';
import RecentWidget from '../widgets/RecentWidget';

const TUESDAY = '2026-09-29';

beforeEach(async () => {
  setNow(() => new Date(`${TUESDAY}T10:00:00`).getTime());
  await db.table('bookmarks_item').clear();
});

const create = (over: Partial<BookmarkItem>) =>
  itemRepo.create({ title: 'x', kind: 'read', tags: [], done: false, started: false, ...over });
const ctx = { today: TUESDAY, until: '2026-10-06' };

describe('the Merkliste as a source of the planner', () => {
  it('offers only what the person marked and has not finished; no date, nothing hard', async () => {
    await create({ title: 'Dune', kind: 'watch', inPlan: true });
    await create({ title: 'Nicht markiert', kind: 'read' });
    await create({ title: 'Schon erledigt', kind: 'read', inPlan: true, done: true });
    // Marked once, then turned into a permanent link: no longer offered.
    await create({ title: 'Bahn', kind: 'link', inPlan: true });
    const items = await source.list(ctx);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'bookmark',
      title: 'Film/Serie: Dune',
      durationMin: 90,
    });
    expect(items[0]!.to).toBe(`/bookmarks?open=${items[0]!.id}`);
    expect(items[0]!.due).toBeUndefined();
    expect(items[0]!.plannedFor).toBeUndefined();
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.version).toBe(4);
  });

  it('ticked in the plan is "Erledigt"; an estimate edited there is kept', async () => {
    const item = await create({ title: 'Artikel', inPlan: true, started: true });
    expect(planMinutesOf(item)).toBe(20);
    await source.onEstimate!(item.id, 45.4);
    expect((await source.list(ctx))[0]!.durationMin).toBe(45);
    await source.onDone!(item.id);
    expect(await itemRepo.get(item.id)).toMatchObject({ done: true, started: false });
    expect(await source.list(ctx)).toEqual([]);
    // A thing that is gone meanwhile is left alone.
    await expect(source.onDone!('missing')).resolves.toBeUndefined();
    await expect(source.onEstimate!('missing', 10)).resolves.toBeUndefined();
  });

  it('old records without the plan fields still parse', () => {
    const parsed = itemSchema.parse({ title: 'Alt', kind: 'read' });
    expect(parsed.inPlan).toBeUndefined();
    expect(parsed.planMinutes).toBeUndefined();
  });
});

describe('"In den Plan" in the menu', () => {
  const menu = async (over: Partial<BookmarkItem>, plan = true) =>
    bookmarkMenu((await create(over)) as Stored<BookmarkItem>, { edit: () => {}, plan }).map(
      (m) => m.id,
    );

  it('an open item offers "In den Plan", a marked one the way out, a done one neither', async () => {
    expect(await menu({})).toContain('plan');
    expect(await menu({ inPlan: true })).toContain('unplan');
    expect(await menu({ inPlan: true })).not.toContain('plan');
    const done = await menu({ done: true });
    expect(done).not.toContain('plan');
    expect(done).not.toContain('unplan');
    // No entry while the planner is off (`plan: false`), and never for a permanent link.
    expect(await menu({}, false)).not.toContain('plan');
    expect(await menu({ kind: 'link' })).not.toContain('plan');
  });

  it('taking it out keeps the Merkzettel', async () => {
    const item = (await create({ title: 'Dune', inPlan: true })) as Stored<BookmarkItem>;
    bookmarkMenu(item, { edit: () => {}, plan: true }).find((m) => m.id === 'unplan')!.onSelect!();
    await new Promise((r) => setTimeout(r, 50));
    expect(await itemRepo.get(item.id)).toMatchObject({ title: 'Dune', inPlan: false });
  });
});

describe('widget "Als Nächstes"', () => {
  const make = (title: string, createdAt: number, over: Partial<BookmarkItem> = {}) => ({
    ...itemSchema.parse({ title, kind: 'read', ...over }),
    createdAt,
  });

  it('picks three: in the plan, then started, then the newest; never done ones or permanent links', () => {
    const picked = pickNext([
      make('Alt', 1),
      make('Neu', 5),
      make('Angefangen', 2, { started: true }),
      make('Im Plan', 3, { inPlan: true }),
      make('Erledigt', 9, { done: true, inPlan: true }),
      make('Bahn', 8, { kind: 'link' }),
    ]);
    expect(picked.map((i) => i.title)).toEqual(['Im Plan', 'Angefangen', 'Neu']);
    expect(pickNext([])).toEqual([]);
    // With the planner off the mark means nothing: it neither ranks nor shows.
    expect(
      pickNext([make('Im Plan', 1, { inPlan: true }), make('Neu', 5)], 3, false).map(
        (i) => i.title,
      ),
    ).toEqual(['Neu', 'Im Plan']);
  });

  it('the weekend starts on Friday', () => {
    expect(isWeekendNear('2026-10-01')).toBe(false); // Thursday
    expect(isWeekendNear('2026-10-02')).toBe(true); // Friday
    expect(isWeekendNear('2026-10-04')).toBe(true); // Sunday
    expect(isWeekendNear('2026-10-05')).toBe(false); // Monday
  });

  it('shows the three with their kind and one calm line, no count', async () => {
    await enableModule(getManifest('planner')!);
    await create({ title: 'Dune', kind: 'watch', inPlan: true });
    await create({ title: 'Kopfhörer', kind: 'buy' });
    const view = render(
      <MemoryRouter>
        <RecentWidget />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Dune')).toBeVisible();
    expect(screen.getByText('Als Nächstes · such dir eins aus')).toBeVisible();
    expect(screen.getByText('Film/Serie · im Plan')).toBeVisible();
    expect(screen.getByText('Kaufen')).toBeVisible();
    expect(view.container.textContent).not.toMatch(/\d+ offene/);
    view.unmount();

    setNow(() => new Date('2026-10-03T10:00:00').getTime());
    render(
      <MemoryRouter>
        <RecentWidget />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Fürs Wochenende · such dir eins aus')).toBeVisible();
  });
});
