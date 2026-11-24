// @vitest-environment jsdom
/**
 * A Merkliste entry's plan panel (planner hub 2, package 4a, hand-off 04): title and host as text, X13 „Im Browser
 * öffnen“ opens the address only on that tap, no „Erledigt“ of its own (the row's tick), and it writes nothing.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { PlanPanelHost } from '@/core/modules/PlanPanelHost';
import { itemRepo } from '../repo';

const openUrl = vi.fn(async () => undefined);
vi.mock('@/core/platform', async (orig) => {
  const real = await orig<{ getPlatform: () => { app: object } }>();
  return {
    ...real,
    getPlatform: () => ({ ...real.getPlatform(), app: { ...real.getPlatform().app, openUrl } }),
  };
});

beforeEach(async () => {
  for (const t of ['bookmarks_item', '_modules']) await db.table(t).clear();
  await db.table('_modules').put({
    id: 'bookmarks',
    enabled: true,
    dataPolicy: null,
    createdAt: 1,
    updatedAt: 1,
    deviceId: 't',
    deletedAt: null,
    _f: {},
  });
  openUrl.mockClear();
});

const panel = (id: string) =>
  render(
    <MemoryRouter>
      <PlanPanelHost moduleId="bookmarks" id={id} to={`/bookmarks?open=${id}`} />
    </MemoryRouter>,
  );

it('title and host; „Im Browser öffnen“ only on the tap; no tick of its own', async () => {
  await itemRepo.create(
    {
      title: 'Fahrradträger',
      url: 'https://www.example.org/fahrradtraeger',
      kind: 'try',
      tags: [],
      done: false,
      started: false,
      inPlan: true,
    },
    { id: 'bm1' },
  );
  panel('bm1');
  expect(await screen.findByText('Fahrradträger')).toBeInTheDocument();
  expect(screen.getByText('example.org')).toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(openUrl).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Im Browser öffnen' }));
  expect(openUrl).toHaveBeenCalledWith('https://www.example.org/fahrradtraeger');
  expect(screen.getByRole('button', { name: 'Ganz öffnen' })).toBeInTheDocument();
  expect((await itemRepo.get('bm1'))?.updatedAt).toBe((await itemRepo.get('bm1'))?.createdAt);
});

it('an address that is not http(s) (synced, imported) is never offered to the browser', async () => {
  for (const [i, url] of [
    'javascript:alert(1)',
    'file:///etc/passwd',
    'data:text/html,x',
  ].entries())
    await itemRepo.create(
      { title: `Ding ${i}`, url, kind: 'try', tags: [], done: false, started: false, inPlan: true },
      { id: `x${i}` },
    );
  for (const i of [0, 1, 2]) {
    const { unmount } = panel(`x${i}`);
    expect(await screen.findByText(`Ding ${i}`)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Im Browser öffnen' })).toBeNull();
    unmount();
  }
  expect(openUrl).not.toHaveBeenCalled();
});

it('an entry that is gone: X3', async () => {
  panel('nope');
  expect(await screen.findByText('Gibt es nicht mehr.')).toBeInTheDocument();
});
