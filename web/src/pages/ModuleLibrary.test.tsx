import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createRepo } from '@/core/db/repo';
import { enableModule } from '@/core/modules/activation';
import example from '@/modules/example/manifest';
import { t } from '@/strings';
import { ModuleLibrary } from './ModuleLibrary';

const entries = () => createRepo('example_entry', example.dataSchema.collections.entry!.schema);

beforeEach(async () => {
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

/** Buttons are disabled until the module states have loaded; wait for that before clicking. */
async function button(card: ReturnType<typeof within>, name: string) {
  const b = await card.findByRole('button', { name });
  await waitFor(() => expect(b).toBeEnabled());
  return b;
}

describe('ModuleLibrary', () => {
  it('lists modules with description and toggles activation', async () => {
    const user = userEvent.setup();
    const card = await renderLibrary();
    expect(card.getByText(example.description)).toBeInTheDocument();
    expect(card.queryByText(t.library.active)).not.toBeInTheDocument();

    await user.click(await button(card, t.actions.enable));
    expect(await card.findByText(t.library.active)).toBeInTheDocument();
    expect((await db.table('_modules').get('example'))?.enabled).toBe(true);
  });

  it('asks what to do with data and keeps it on "keep"', async () => {
    const user = userEvent.setup();
    await enableModule(example);
    await entries().create({ title: 'stay', done: false });
    const card = await renderLibrary();

    await user.click(await button(card, t.actions.disable));
    await user.click(await screen.findByRole('button', { name: t.library.keepData }));
    expect(await card.findByRole('button', { name: t.actions.enable })).toBeInTheDocument();
    expect(await entries().active().count()).toBe(1);
  });

  it('deletes data on "delete"', async () => {
    const user = userEvent.setup();
    await enableModule(example);
    await entries().create({ title: 'gone', done: false });
    const card = await renderLibrary();

    await user.click(await button(card, t.actions.disable));
    await user.click(await screen.findByRole('button', { name: t.library.deleteData }));
    await card.findByRole('button', { name: t.actions.enable });
    expect(await entries().active().count()).toBe(0);
  });
});
