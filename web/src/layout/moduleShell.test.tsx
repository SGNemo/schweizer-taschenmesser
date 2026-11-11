// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePageActionStore } from '@/core/shell/pageAction';
import { HEAD_VARIANTS, SIGNATURE_SLOTS } from '@/core/modules/types';
import { t } from '@/strings';
import { PageAction, PageHeader, Tabs } from '@/ui';
import { HeroFigure, HeroSlot } from '@/ui/identity';
import { AreaFrame } from './AreaFrame';

function page(path: string, content = <PageHeader title="Finanzen" />) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AreaFrame>{content}</AreaFrame>
    </MemoryRouter>,
  );
}

/** The phone layout: every `(max-width: …)` query matches. */
function asPhone() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('max-width'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('module frame (Identity 4.0: one title row with tabs)', () => {
  it('carries the manifest identity as data attributes (hue, head variant, area, signature)', async () => {
    page('/finance');
    const frame = await screen.findByTestId('module-frame');
    expect(frame).toHaveAttribute('data-hue', 'teal');
    expect(frame).toHaveAttribute('data-head', 'standard');
    expect(frame).toHaveAttribute('data-area', 'money');
    expect(frame).toHaveAttribute('data-signature', 'bankCard');
    expect(frame).not.toHaveAttribute('data-surface');
    // The nine silhouettes and their two height classes are gone: one row height for every standard head.
    expect(frame).not.toHaveAttribute('data-size');
  });

  it('the frame names the head variant: standard everywhere, a stage for weather (modules that are on by default)', async () => {
    expect([...HEAD_VARIANTS]).toEqual(['standard', 'stage']);
    for (const [path, head] of [
      ['/todos', 'standard'],
      ['/calendar', 'standard'],
      ['/weather', 'stage'],
    ] as const) {
      const { unmount } = page(path);
      const frame = await screen.findByTestId('module-frame');
      expect(frame, path).toHaveAttribute('data-head', head);
      // Every head has the same title row, whatever its variant.
      expect(within(frame).getByTestId('module-title-row'), path).toBeTruthy();
      unmount();
    }
  });

  it('desktop: the other modules of the area are no navigation of their own any more (the sidebar lists them)', async () => {
    page('/finance');
    await screen.findByTestId('module-frame');
    expect(screen.queryByRole('navigation', { name: t.nav.areaTabs('Geld') })).toBeNull();
    expect(screen.queryByTestId('subnav')).toBeNull();
  });

  it('phone: the modules of the area are the one module row inside the head, under the title row', async () => {
    asPhone();
    page('/finance');
    const frame = await screen.findByTestId('module-frame');
    const nav = await screen.findByRole('navigation', { name: t.nav.areaTabs('Geld') });
    expect(frame.contains(nav)).toBe(true);
    expect(within(nav).getByRole('link', { name: 'Finanzen' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getAllByRole('link').length).toBeGreaterThan(1);
    // Title row first, then the module row.
    const row = within(frame).getByTestId('module-title-row');
    expect(row.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('the page title (h1) renders inside the title row, exactly once; the eyebrow names the area', async () => {
    page('/finance');
    const frame = await screen.findByTestId('module-frame');
    const row = within(frame).getByTestId('module-title-row');
    const h1 = await within(row).findByRole('heading', { level: 1, name: 'Finanzen' });
    expect(h1).toBeVisible();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(within(row).getByTestId('module-eyebrow')).toHaveTextContent(/^Geld$/);
  });

  it('eyebrow "area · context": a page with another title names its module', async () => {
    page('/finance', <PageHeader title="Konten" />);
    const frame = await screen.findByTestId('module-frame');
    await within(frame).findByRole('heading', { level: 1, name: 'Konten' });
    expect(within(frame).getByTestId('module-eyebrow')).toHaveTextContent('Geld · Finanzen');
  });

  it('the views of PageHeader are the tabs at the lower edge of the head, after the title row', async () => {
    page(
      '/finance',
      <PageHeader
        title="Finanzen"
        views={
          <Tabs
            label="Ansichten"
            value="a"
            options={[
              { value: 'a', label: 'Übersicht' },
              { value: 'b', label: 'Buchungen' },
            ]}
            onChange={() => undefined}
          />
        }
      />,
    );
    const frame = await screen.findByTestId('module-frame');
    const tabs = await within(frame).findByRole('navigation', { name: 'Ansichten' });
    const row = within(frame).getByTestId('module-title-row');
    expect(row.contains(tabs)).toBe(false);
    expect(row.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Nothing of the head follows the tabs: they are its last row.
    expect(frame.lastElementChild?.lastElementChild?.contains(tabs)).toBe(true);
  });

  it('desktop: the actions of PageHeader sit in the title row, with the one filled module action', async () => {
    page(
      '/finance',
      <PageHeader title="Finanzen">
        <button type="button">Mehr</button>
        <PageAction short="Buchung" onClick={() => undefined}>
          Neue Buchung
        </PageAction>
      </PageHeader>,
    );
    const frame = await screen.findByTestId('module-frame');
    const row = within(frame).getByTestId('module-title-row');
    expect(await within(row).findByRole('button', { name: 'Neue Buchung' })).toBeVisible();
    expect(within(row).getByRole('button', { name: 'Mehr' })).toBeVisible();
    expect(row.querySelectorAll('[data-page-action]')).toHaveLength(1);
    // The head no longer has a write button of its own ("Mit KI eintragen" lives in the capture sheet and the palette).
    expect(screen.queryByTestId('ai-write-button')).toBeNull();
  });

  it('phone: the head holds no control; the page action is declared for the plus in the bottom bar', async () => {
    asPhone();
    let ran = 0;
    page(
      '/finance',
      <PageHeader title="Finanzen">
        <button type="button">Mehr</button>
        <PageAction short="Buchung" onClick={() => ran++}>
          Neue Buchung
        </PageAction>
      </PageHeader>,
    );
    const frame = await screen.findByTestId('module-frame');
    const row = within(frame).getByTestId('module-title-row');
    expect(within(row).queryAllByRole('button')).toEqual([]);
    expect(within(row).queryAllByRole('link')).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Neue Buchung' })).toBeNull();
    // What is left of the page's actions stays reachable, as a row in the page.
    expect(screen.getByRole('button', { name: 'Mehr' })).toBeVisible();
    expect(frame.contains(screen.getByRole('button', { name: 'Mehr' }))).toBe(false);
    const action = usePageActionStore.getState().action;
    expect(action).toMatchObject({ short: 'Buchung', disabled: false });
    act(() => action?.run());
    expect(ran).toBe(1);
  });

  it('the page action goes when the page goes', async () => {
    const view = page(
      '/finance',
      <PageHeader title="Finanzen">
        <PageAction short="Buchung" onClick={() => undefined}>
          Neue Buchung
        </PageAction>
      </PageHeader>,
    );
    await screen.findByTestId('module-frame');
    expect(usePageActionStore.getState().action?.short).toBe('Buchung');
    view.unmount();
    expect(usePageActionStore.getState().action).toBeUndefined();
  });

  it('the one figure lands in the title row, beside the title', async () => {
    page(
      '/finance',
      <>
        <PageHeader title="Finanzen" />
        <HeroSlot area="figure">
          <HeroFigure value="12.616,33 €" detail="3 Konten" testId="figure" />
        </HeroSlot>
      </>,
    );
    const frame = await screen.findByTestId('module-frame');
    const row = within(frame).getByTestId('module-title-row');
    expect(await within(row).findByTestId('figure')).toHaveTextContent('12.616,33 €');
    expect(within(row).getByText('3 Konten')).toBeVisible();
  });

  it('standard head: no signature slot; a block the page still brings lies in the page, under the head', async () => {
    expect(SIGNATURE_SLOTS).toEqual({ standard: 'none', stage: 'L' });
    page(
      '/finance',
      <>
        <PageHeader title="Finanzen" />
        <HeroSlot area="signature">
          <span data-testid="own-signature">Karten</span>
        </HeroSlot>
        <HeroSlot>
          <span data-testid="own-strip">Streifen</span>
        </HeroSlot>
      </>,
    );
    const frame = await screen.findByTestId('module-frame');
    expect(frame).toHaveAttribute('data-slot', 'none');
    // The frame draws no default signature in a standard head (the calendar's day block included).
    expect(within(frame).queryByTestId('module-signature')).toBeNull();
    expect(frame.querySelector('[data-signature="bankCard"]')).toBeNull();
    const below = screen.getByTestId('module-below');
    expect(frame.contains(below)).toBe(false);
    expect(await within(below).findByTestId('own-signature')).toBeVisible();
    expect(within(below).getByTestId('own-strip')).toBeVisible();
  });

  it('the calendar head is a title row like every other: the day block left the head', async () => {
    page('/calendar', <PageHeader title="Kalender" />);
    const frame = await screen.findByTestId('module-frame');
    expect(frame).toHaveAttribute('data-head', 'standard');
    expect(within(frame).queryByTestId('day-block')).toBeNull();
    expect(within(frame).queryByTestId('hour-strip')).toBeNull();
  });

  it('stage head: the frame draws the signature on the stage until the page fills the slot', async () => {
    const { unmount } = page('/weather', <PageHeader title="Wetter" />);
    const frame = await screen.findByTestId('module-frame');
    expect(frame).toHaveAttribute('data-slot', 'L');
    const slot = within(frame).getByTestId('module-signature');
    expect(slot).toHaveAttribute('data-default', 'true');
    expect(slot.querySelector('[data-signature="sky"]')).not.toBeNull();
    unmount();
    page(
      '/weather',
      <>
        <PageHeader title="Wetter" />
        <HeroSlot area="signature">
          <span data-testid="own-signature">Himmel</span>
        </HeroSlot>
      </>,
    );
    const frame2 = await screen.findByTestId('module-frame');
    const slot2 = within(frame2).getByTestId('module-signature');
    expect(await within(slot2).findByTestId('own-signature')).toBeVisible();
    expect(slot2).not.toHaveAttribute('data-default');
    expect(slot2.querySelector('[data-signature="sky"]')).toBeNull();
    // On a stage there is no second place for it in the page.
    expect(screen.queryByTestId('module-below')).toBeNull();
  });

  it('there is no second bar for a scrolled phone page: the head itself stays (sticky), nothing is duplicated', async () => {
    asPhone();
    page('/finance', <PageHeader title="Konten" />);
    await screen.findByTestId('module-frame');
    expect(screen.queryByTestId('module-compact')).toBeNull();
    expect(screen.getAllByText('Konten')).toHaveLength(1);
  });

  it('outside a module page the title stays where it is (no head around it)', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <AreaFrame>
          <PageHeader title="Einstellungen" />
        </AreaFrame>
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('module-frame')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
  });

  it('PageHeader without any shell (dialogs, tests) renders its h1, views and action in place', () => {
    render(
      <PageHeader title="Allein" views={<span>Ansicht</span>}>
        <PageAction short="Ding" onClick={() => undefined}>
          Neues Ding
        </PageAction>
      </PageHeader>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Allein' })).toBeVisible();
    expect(screen.getByText('Ansicht')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Neues Ding' })).toBeVisible();
    // Nothing is declared to a shell that is not there.
    expect(usePageActionStore.getState().action).toBeUndefined();
    act(() => undefined);
  });
});
