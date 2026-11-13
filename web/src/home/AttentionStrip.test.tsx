// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { patchFocusSettings } from '@/core/settings/focus';
import type * as ContributionsModule from '@/core/modules/contributions';
import { useLiveAttention } from '@/core/modules/liveAttention';
import { useUpdateStore } from '@/core/update/controller';

const items = vi.hoisted(() => ({ value: [] as unknown[] | undefined }));
vi.mock('@/core/modules/contributions', async (original) => ({
  ...(await original<typeof ContributionsModule>()),
  useAttentionItems: () => items.value,
}));

import { AttentionStrip } from './AttentionStrip';

const draw = () =>
  render(
    <MemoryRouter>
      <AttentionStrip />
    </MemoryRouter>,
  );

describe('AttentionStrip (classic: calm mode off)', () => {
  beforeEach(async () => {
    await db.table('_settings').clear();
    await patchFocusSettings({ calmAttention: false });
    items.value = [];
    useLiveAttention.setState({ bySource: {} });
    useUpdateStore.setState({ state: { phase: 'idle' } });
  });
  afterEach(cleanup);
  it('renders nothing when nothing is urgent', () => {
    const { container } = draw();
    expect(container.firstChild).toBeNull();
  });
  it('shows items as links with icon and text', async () => {
    items.value = [
      {
        id: 'i',
        tone: 'danger',
        icon: 'receipt',
        title: '2 Rechnungen überfällig',
        detail: '897,89 €',
        to: '/invoices',
      },
    ];
    draw();
    const link = await screen.findByRole('link', { name: /2 Rechnungen überfällig/ });
    expect(link.getAttribute('href')).toBe('/invoices');
    expect(link.getAttribute('data-tone')).toBe('danger');
    // "Werte ausblenden" is read first (amounts stay dots until then); off by default.
    expect(await screen.findByText('897,89 €')).toBeTruthy();
  });
  it('merges items that widgets publish live (e.g. a full drive)', async () => {
    useLiveAttention
      .getState()
      .publish('disk:drives', [
        { id: 'd', tone: 'warning', icon: 'disk', title: 'Laufwerk C:\\ fast voll', to: '/disk' },
      ]);
    draw();
    expect((await screen.findByRole('link', { name: /fast voll/ })).getAttribute('data-tone')).toBe(
      'warning',
    );
  });
  it('adds the update notice', () => {
    useUpdateStore.setState({
      state: { phase: 'available', info: { version: '0.5.0', notes: '', prerelease: false } },
    });
    draw();
    expect(screen.getByRole('link', { name: /Update verfügbar/ })).toBeTruthy();
  });
});

describe('AttentionStrip (calm, the default)', () => {
  beforeEach(async () => {
    await db.table('_settings').clear();
    items.value = [];
    useLiveAttention.setState({ bySource: {} });
    useUpdateStore.setState({ state: { phase: 'idle' } });
  });
  afterEach(cleanup);

  it('keeps today and everything overdue visible, folds the rest into "Kann warten"', async () => {
    items.value = [
      {
        id: 'a',
        tone: 'accent',
        icon: 'checklist',
        title: '2 ToDos heute fällig',
        to: '/todos',
        due: 'today',
      },
      {
        id: 'b',
        tone: 'danger',
        icon: 'receipt',
        title: '2 Rechnungen überfällig',
        to: '/invoices',
      },
      { id: 'c', tone: 'warning', icon: 'checklist', title: '8 ToDos warten', to: '/todos' },
      // Accent without `due` (a deadline of the coming days): only what is not due folds, whatever its tone.
      { id: 'd', tone: 'accent', icon: 'file', title: '1 Frist läuft bald ab', to: '/vault' },
    ];
    const { container } = draw();
    const waiting = await screen.findByTestId('attention-waiting');
    expect(waiting).toHaveTextContent('Kann warten · 2');
    expect(waiting).toHaveTextContent('nichts davon muss heute sein.');
    expect(waiting.getAttribute('aria-expanded')).toBe('false');
    const folded = screen.getByTestId('attention-waiting-list');
    expect(folded.hasAttribute('hidden')).toBe(true);
    // The "today" card is outside the folded block.
    const today = screen.getByRole('link', { name: /2 ToDos heute fällig/ });
    expect(folded.contains(today)).toBe(false);
    // Overdue money is not folded away (QA B18/B08); it keeps its red hairline (colour plus icon plus text).
    const overdue = screen.getByRole('link', { name: /2 Rechnungen überfällig/ });
    expect(folded.contains(overdue)).toBe(false);
    expect(container.querySelector('[data-tone="danger"]')?.textContent).toContain('überfällig');
    // Only entries without `due` are folded: the accent one of the coming days and the warning one.
    expect(Array.from(folded.querySelectorAll('a')).map((x) => x.getAttribute('href'))).toEqual([
      '/vault',
      '/todos',
    ]);
  });

  it('opens the folded cards with the line and names at most two of them in it', async () => {
    const budget = (id: string) => ({
      id: `budgets:warn:${id}`,
      tone: 'warning',
      icon: 'piggy',
      title: `${id}: 96 % des Budgets verbraucht`,
      to: '/budgets',
      rank: 1,
      foldSummary: (n: number) => `${n} Budgets fast aufgebraucht`,
    });
    items.value = [
      budget('Abos'),
      budget('Wohnen'),
      { id: 'p', tone: 'warning', icon: 'package', title: '1 Vorrat abgelaufen', to: '/pantry' },
      {
        id: 'q',
        tone: 'warning',
        icon: 'package',
        title: '2 Vorräte gehen zur Neige',
        to: '/pantry',
      },
    ];
    draw();
    const line = await screen.findByTestId('attention-waiting');
    expect(line.textContent).toBe(
      'Kann warten · 4 · 2 Budgets fast aufgebraucht, 1 Vorrat abgelaufen … · nichts davon muss heute sein.',
    );
    fireEvent.click(line);
    expect(line.getAttribute('aria-expanded')).toBe('true');
    const folded = screen.getByTestId('attention-waiting-list');
    expect(folded.hasAttribute('hidden')).toBe(false);
    expect(folded.querySelectorAll('a')).toHaveLength(4);
  });

  it('shows every overdue and due entry, also more than six, and no line when nothing waits', async () => {
    items.value = [
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `d${i}`,
        tone: 'danger',
        icon: 'receipt',
        title: `Rechnung ${i} überfällig`,
        to: '/invoices',
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        id: `t${i}`,
        tone: 'accent',
        icon: 'dumbbell',
        title: `Heute 1${i}:00 · Training`,
        to: '/fitness',
        due: 'today',
      })),
    ];
    draw();
    expect(await screen.findAllByRole('link')).toHaveLength(7);
    expect(screen.queryByTestId('attention-waiting')).toBeNull();
  });

  it('leaves out an entry that a block on the page lists itself', async () => {
    items.value = [
      {
        id: 'calendar:next',
        tone: 'accent',
        icon: 'calendar',
        title: 'Friseur',
        to: '/calendar',
        due: 'today',
        coveredBy: ['agenda', 'today'],
      },
    ];
    // The agenda is on the page and lists the appointment.
    const on = render(
      <MemoryRouter>
        <AttentionStrip covers={['agenda']} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(on.container.firstChild).toBeNull());
    on.unmount();
    // No block lists it: the strip names it.
    render(
      <MemoryRouter>
        <AttentionStrip covers={[]} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('link', { name: /Friseur/ })).toBeTruthy();
  });

  it('shows only the folded line when nothing needs action today', async () => {
    items.value = [
      { id: 'c', tone: 'warning', icon: 'checklist', title: '8 ToDos warten', to: '/todos' },
    ];
    draw();
    await screen.findByTestId('attention-waiting');
    expect(screen.queryByRole('heading', { name: 'Jetzt wichtig' })).toBeNull();
  });

  it('is the classic strip again when the setting is off', async () => {
    await patchFocusSettings({ calmAttention: false });
    items.value = [
      { id: 'c', tone: 'warning', icon: 'checklist', title: '8 ToDos warten', to: '/todos' },
    ];
    draw();
    await waitFor(() => expect(screen.queryByTestId('attention-waiting')).toBeNull());
    expect(screen.getByRole('heading', { name: 'Jetzt wichtig' })).toBeInTheDocument();
  });
});

describe('AttentionStrip cards (identity v3)', () => {
  beforeEach(async () => {
    await db.table('_settings').clear();
    await patchFocusSettings({ calmAttention: false });
    items.value = [];
    useLiveAttention.setState({ bySource: {} });
    useUpdateStore.setState({ state: { phase: 'idle' } });
  });
  afterEach(cleanup);

  it('shows the count as a big figure, the text beside it and the module hue on the card', async () => {
    items.value = [
      {
        id: 'i',
        tone: 'danger',
        icon: 'receipt',
        title: '2 Rechnungen überfällig',
        detail: '897,89 €',
        to: '/invoices',
      },
    ];
    draw();
    const link = await screen.findByRole('link', { name: /2 Rechnungen überfällig/ });
    expect(link.getAttribute('data-hue')).toBe('ocean');
    expect(link.querySelector('b')?.textContent).toBe('2');
    expect(link.textContent).toContain('Rechnungen überfällig');
    // The plate carries the icon and is decoration only.
    expect(link.querySelector('[aria-hidden="true"] svg')).not.toBeNull();
  });
  it('keeps a title without a count in one line and gives core items no hue', async () => {
    useUpdateStore.setState({
      state: { phase: 'available', info: { version: '0.5.0', notes: '', prerelease: false } },
    });
    items.value = [
      {
        id: 'b',
        tone: 'warning',
        icon: 'piggy',
        title: 'Budget „Freizeit“ überschritten',
        to: '/budgets',
      },
    ];
    const { container } = draw();
    const update = await screen.findByRole('link', { name: /Update verfügbar/ });
    expect(update.getAttribute('data-hue')).toBeNull();
    expect(container.querySelectorAll('b').length).toBe(0);
    // With the setting off the entry is a card (it waits behind the line until the setting is read).
    expect((await screen.findByRole('link', { name: /Freizeit/ })).getAttribute('data-hue')).toBe(
      'lime',
    );
  });
});

it('"Werte ausblenden" turns the amounts of a card into dots, the words stay', async () => {
  await db.table('_settings').clear();
  await patchFocusSettings({ calmAttention: false });
  await db.table('_meta').put({ key: 'focus.hideValues', value: true });
  useLiveAttention.setState({ bySource: {} });
  useUpdateStore.setState({ state: { phase: 'idle' } });
  items.value = [
    {
      id: 'budgets:warn:b',
      tone: 'warning',
      icon: 'piggy',
      title: 'Wohnen: 96 % des Budgets verbraucht',
      detail: 'noch 35,00 €',
      to: '/budgets',
    },
  ];
  try {
    draw();
    const card = await screen.findByRole('link', { name: /Wohnen/ });
    await waitFor(() => expect(card.textContent).toContain('noch ••••'));
    expect(card.textContent).not.toMatch(/35,00/);
    // A screen reader hears "Ausgeblendet", not the dots.
    const dots = Array.from(card.querySelectorAll('[aria-hidden="true"]')).filter(
      (el) => el.textContent === '••••',
    );
    expect(dots).toHaveLength(1);
    expect(card.textContent).toContain('Ausgeblendet');
  } finally {
    await db.table('_meta').delete('focus.hideValues');
    cleanup();
  }
});
