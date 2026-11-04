// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createRepo } from '@/core/db/repo';
import { enableModule, moduleHasData } from '@/core/modules/activation';
import example from '@/modules/example/manifest';
import maps from '@/modules/maps/manifest';
import { markLibrarySeen } from '@/core/modules/librarySeen';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { tComfort } from '@/strings.comfort';
import { tLibraryV3 } from '@/strings.libraryV3';
import { ModuleLibrary } from './ModuleLibrary';
import { LibraryDetail } from './library/LibraryDetail';

const entries = () => createRepo('example_entry', example.dataSchema.collections.entry!.schema);

afterEach(() => useUiStore.setState({ showPreview: useUiStore.getInitialState().showPreview }));

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

describe('ModuleLibrary in identity v3', () => {
  it('the head counts active and available modules and the card shows its identity', async () => {
    await enableModule(example);
    const card = await renderLibrary();
    const figures = within(screen.getByTestId('library-figures'));
    await waitFor(() => expect(figures.getByText(tLibraryV3.get().figures.active)).toBeVisible());
    const read = () => {
      const list = screen.getByTestId('library-figures').textContent ?? '';
      return {
        active: Number(/(\d+)\s*aktiv/.exec(list)?.[1]),
        available: Number(/(\d+)\s*verfügbar/.exec(list)?.[1]),
      };
    };
    // the module states load after the first render; example is on, so at least one is active
    await waitFor(() => expect(read().active).toBeGreaterThanOrEqual(1));
    expect(read().available).toBeGreaterThanOrEqual(read().active);
    // the card carries the module's hue and a drawn widget sketch, no live widget
    const el = screen.getByTestId('module-example');
    expect(el).toHaveAttribute('data-hue', example.identity.hue);
    expect(card.getByTestId('widget-miniature')).toHaveAttribute(
      'data-variant',
      example.identity.widget,
    );
    expect(
      card.getByRole('link', { name: tLibraryV3.get().detailsOf(example.name) }),
    ).toHaveAttribute('href', '/library/example');
  });

  it('the filter shows only what is on or off', async () => {
    const user = userEvent.setup();
    await renderLibrary();
    const f = tLibraryV3.get().filter;
    await user.click(screen.getByRole('button', { name: f.active }));
    await waitFor(() => expect(screen.queryByTestId('module-example')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: f.off }));
    expect(await screen.findByTestId('module-example')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: f.all }));
    expect(await screen.findByTestId('module-example')).toBeInTheDocument();
  });
});

describe('ModuleLibrary filter states', () => {
  it('an empty result under a filter offers the way back', async () => {
    const user = userEvent.setup();
    await renderLibrary();
    const f = tLibraryV3.get().filter;
    // example is off: searching for it under "Aktiv" leaves nothing
    await user.type(
      screen.getByRole('searchbox', { name: tComfort.get().library.search }),
      example.name.slice(0, 4),
    );
    expect(await screen.findByTestId('module-example')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: f.active }));
    const status = await screen.findByRole('status');
    expect(within(status).getByText(tComfort.get().library.noResults)).toBeVisible();
    // the reset button is next to the live region, not inside it (screen readers announce only the text)
    expect(within(status).queryByRole('button')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: f.reset }));
    expect(await screen.findByTestId('module-example')).toBeInTheDocument();
    // the status region stays mounted (screen readers announce what is put into it) but is empty again
    expect(status).toBeEmptyDOMElement();
  });

  it('a card switched under the "Aus" filter stays until the filter changes', async () => {
    const user = userEvent.setup();
    const card = await renderLibrary();
    const f = tLibraryV3.get().filter;
    await user.click(screen.getByRole('button', { name: f.off }));
    await user.click(await toggle(card));
    await waitFor(async () =>
      expect((await db.table('_modules').get('example'))?.enabled).toBe(true),
    );
    // switched on, but still listed (focus stays on its switch) until the filter is changed
    expect(screen.getByTestId('module-example')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: f.all }));
    await user.click(screen.getByRole('button', { name: f.off }));
    await waitFor(() => expect(screen.queryByTestId('module-example')).not.toBeInTheDocument());
  });
});

describe('preview modules under the library filter', () => {
  it('a preview module switched off while "In Arbeit anzeigen" is off stays listed until the filter changes', async () => {
    const user = userEvent.setup();
    useUiStore.setState({ showPreview: false });
    await enableModule(maps);
    await renderLibrary();
    const f = tLibraryV3.get().filter;
    await user.click(screen.getByRole('button', { name: f.active }));
    const card = within(await screen.findByTestId('module-maps'));
    await user.click(await toggle(card));
    await waitFor(async () =>
      expect((await db.table('_modules').get('maps'))?.enabled).toBe(false),
    );
    // off now, so out of the catalogue; the card is held (focus stays) until the person changes the filter
    expect(screen.getByTestId('module-maps')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: f.all }));
    await waitFor(() => expect(screen.queryByTestId('module-maps')).not.toBeInTheDocument());
  });
});

describe('LibraryDetail', () => {
  function renderDetail(id: string) {
    render(
      <MemoryRouter initialEntries={[`/library/${id}`]}>
        <Routes>
          <Route path="/library/:moduleId" element={<LibraryDetail />} />
          <Route path="/library" element={<p>library</p>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('shows the module as a small page with the same switch as the card', async () => {
    const user = userEvent.setup();
    renderDetail('example');
    expect(await screen.findByRole('heading', { level: 1, name: example.name })).toBeVisible();
    expect(screen.getByTestId('library-detail-head')).toHaveAttribute(
      'data-hue',
      example.identity.hue,
    );
    expect(screen.getByTestId('widget-miniature')).toHaveAttribute('data-size', 'lg');
    const sw = await screen.findByRole('switch', { name: /einschalten/ });
    await waitFor(() => expect(sw).toBeEnabled());
    await user.click(sw);
    await waitFor(async () =>
      expect((await db.table('_modules').get('example'))?.enabled).toBe(true),
    );
  });

  it('an unknown module keeps one h1 and a way back', async () => {
    renderDetail('doesnotexist');
    expect(await screen.findByText(tLibraryV3.get().detail.notFound)).toBeVisible();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('link', { name: tLibraryV3.get().detail.back })).toHaveAttribute(
      'href',
      '/library',
    );
  });

  it('asks what to do with the data from the detail page too and keeps it on "keep"', async () => {
    const user = userEvent.setup();
    await enableModule(example);
    await entries().create({ title: 'stay', done: false });
    renderDetail('example');
    const sw = await screen.findByRole('switch', { name: /einschalten/ });
    await waitFor(() => expect(sw).toBeEnabled());
    await user.click(sw);
    // the dialog comes first; nothing is deleted without the explicit choice
    expect(await screen.findByRole('button', { name: t.library.keepData })).toBeVisible();
    expect(await entries().active().count()).toBe(1);
    await user.click(screen.getByRole('button', { name: t.library.keepData }));
    await waitFor(async () =>
      expect((await db.table('_modules').get('example'))?.enabled).toBe(false),
    );
    expect(await entries().active().count()).toBe(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('a preview module stays hidden here while "In Arbeit anzeigen" is off, like in the library', async () => {
    useUiStore.setState({ showPreview: false });
    renderDetail('maps');
    expect(await screen.findByText(tLibraryV3.get().detail.notFound)).toBeVisible();
    // positive control: with the switch on, the same module has its page (so the gate was the reason)
    cleanup();
    useUiStore.setState({ showPreview: true });
    renderDetail('maps');
    expect(await screen.findByRole('heading', { level: 1, name: /.+/ })).toBeVisible();
    expect(screen.queryByText(tLibraryV3.get().detail.notFound)).not.toBeInTheDocument();
  });

  it('keeps a preview module on its page after the person switched it off here', async () => {
    const user = userEvent.setup();
    useUiStore.setState({ showPreview: false });
    await enableModule(maps);
    renderDetail('maps');
    const sw = await screen.findByRole('switch', { name: /einschalten/ });
    await waitFor(() => expect(sw).toBeEnabled());
    await user.click(sw);
    await waitFor(async () =>
      expect((await db.table('_modules').get('maps'))?.enabled).toBe(false),
    );
    // not "there is no such module" right after the action (the undo toast is still showing)
    expect(screen.queryByText(tLibraryV3.get().detail.notFound)).not.toBeInTheDocument();
    expect(screen.getByTestId('library-detail')).toBeInTheDocument();
  });
});
