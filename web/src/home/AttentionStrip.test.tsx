// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUpdateStore } from '@/core/update/controller';

const items = vi.hoisted(() => ({ value: [] as unknown[] | undefined }));
vi.mock('@/core/modules/contributions', () => ({ useAttentionItems: () => items.value }));

import { AttentionStrip } from './AttentionStrip';

const draw = () =>
  render(
    <MemoryRouter>
      <AttentionStrip />
    </MemoryRouter>,
  );

describe('AttentionStrip', () => {
  beforeEach(() => {
    items.value = [];
    useUpdateStore.setState({ state: { phase: 'idle' } });
  });
  it('renders nothing when nothing is urgent', () => {
    const { container } = draw();
    expect(container.firstChild).toBeNull();
  });
  it('shows items as links with icon and text', () => {
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
    const link = screen.getByRole('link', { name: /2 Rechnungen überfällig/ });
    expect(link.getAttribute('href')).toBe('/invoices');
    expect(link.getAttribute('data-tone')).toBe('danger');
    expect(screen.getByText('897,89 €')).toBeTruthy();
  });
  it('adds the update notice', () => {
    useUpdateStore.setState({
      state: { phase: 'available', info: { version: '0.5.0', notes: '', prerelease: false } },
    });
    draw();
    expect(screen.getByRole('link', { name: /Update verfügbar/ })).toBeTruthy();
  });
});
