// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createRepo } from '@/core/db/repo';
import { enableModule, moduleHasData } from '@/core/modules/activation';
import example from '@/modules/example/manifest';
import { markLibrarySeen } from '@/core/modules/librarySeen';
import { t } from '@/strings';
import { tComfort } from '@/strings.comfort';
import { ModuleLibrary } from './ModuleLibrary';

const entries = () => createRepo('example_entry', example.dataSchema.collections.entry!.schema);

beforeEach(async () => {
  localStorage.clear();
  await db.table('_modules').clear();
  await db.table('example_entry').clear();
});

async function renderLibrary() {
  render(
    <MemoryRouter>
      <ModuleLibrary />
    </MemoryRouter>,
  );
  return within(await screen.findByTestId('module-example'));
}

/** The switch is disabled until the module states have loaded; wait for that before clicking. */
async function toggle(card: ReturnType<typeof within>) {
  const sw = await card.findByRole('switch', { name: /einschalten/ });
  await waitFor(() => expect(sw).toBeEnabled());
  return sw;
}

describe('ModuleLibrary', () => {
  it('lists modules with description and toggles activation', async () => {
    const user = userEvent.setup();
    const card = await renderLibrary();
    expect(card.getByText(example.description)).toBeInTheDocument();
    expect(card.queryByText(t.library.active)).not.toBeInTheDocument();

    await user.click(await toggle(card));
    expect(await card.findByText(t.library.active)).toBeInTheDocument();
    expect((await db.table('_modules').get('example'))?.enabled).toBe(true);
  });

  it('switches off without a dialog when the module has no data, with undo', async () => {
    const user = userEvent.setup();
    await enableModule(example);
    const card = await renderLibrary();

    await user.click(await toggle(card));
    await waitFor(async () =>
      expect((await db.table('_modules').get('example'))?.enabled).toBe(false),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await moduleHasData(example)).toBe(false);
  });

  it('asks what to do with data and keeps it on "keep"', async () => {
    const user = userEvent.setup();
    await enableModule(example);
    await entries().create({ title: 'stay', done: false });
    expect(await moduleHasData(example)).toBe(true);
    const card = await renderLibrary();

    await user.click(await toggle(card));
    await user.click(await screen.findByRole('button', { name: t.library.keepData }));
    await waitFor(async () =>
      expect((await db.table('_modules').get('example'))?.enabled).toBe(false),
    );
    expect(await entries().active().count()).toBe(1);
  });

  it('deletes data on "delete"', async () => {
    const user = userEvent.setup();
    await enableModule(example);
    await entries().create({ title: 'gone', done: false });
    const card = await renderLibrary();

    await user.click(await toggle(card));
    await user.click(await screen.findByRole('button', { name: t.library.deleteData }));
    await waitFor(async () =>
      expect((await db.table('_modules').get('example'))?.enabled).toBe(false),
    );
    expect(await entries().active().count()).toBe(0);
  });

  it('searches by name, description and purpose words and says when nothing matches', async () => {
    const user = userEvent.setup();
    await renderLibrary();
    const box = screen.getByRole('searchbox', { name: tComfort.get().library.search });
    await user.type(box, 'qqqunbekanntqqq');
    expect(await screen.findByText(tComfort.get().library.noResults)).toBeInTheDocument();
    expect(screen.queryByTestId('module-example')).not.toBeInTheDocument();
    await user.clear(box);
    await user.type(box, example.name.slice(0, 4).toUpperCase());
    expect(await screen.findByTestId('module-example')).toBeInTheDocument();
  });

  it('marks a module that is new since the library was last looked at, once', async () => {
    markLibrarySeen([{ id: 'something-else', version: 1 }]);
    const first = render(
      <MemoryRouter>
        <ModuleLibrary />
      </MemoryRouter>,
    );
    const card = within(await screen.findByTestId('module-example'));
    expect(card.getByText(tComfort.get().library.badgeNew)).toBeInTheDocument();
    first.unmount();
    // Leaving the library counts as having looked at it.
    await renderLibrary().then((c) =>
      expect(c.queryByText(tComfort.get().library.badgeNew)).not.toBeInTheDocument(),
    );
  });
});
