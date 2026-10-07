// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
    expect(screen.getByText('897,89 €')).toBeTruthy();
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

  it('keeps today visible and folds everything else into "Wartet noch"', async () => {
    items.value = [
      { id: 'a', tone: 'accent', icon: 'checklist', title: '2 ToDos heute fällig', to: '/todos' },
      {
        id: 'b',
        tone: 'danger',
        icon: 'receipt',
        title: '2 Rechnungen überfällig',
        to: '/invoices',
      },
      { id: 'c', tone: 'warning', icon: 'checklist', title: '8 ToDos warten', to: '/todos' },
    ];
    const { container } = draw();
    const waiting = await screen.findByTestId('attention-waiting');
    expect(waiting).toHaveTextContent('Wartet noch · 2');
    expect(waiting).toHaveTextContent('Nichts davon muss jetzt sein.');
    expect(waiting.hasAttribute('open')).toBe(false);
    // The "today" chip is outside the folded block.
    const today = screen.getByRole('link', { name: /2 ToDos heute fällig/ });
    expect(waiting.contains(today)).toBe(false);
    // Money keeps its red edge inside the folded block (colour plus icon plus text).
    expect(container.querySelector('[data-tone="danger"]')?.textContent).toContain('überfällig');
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
