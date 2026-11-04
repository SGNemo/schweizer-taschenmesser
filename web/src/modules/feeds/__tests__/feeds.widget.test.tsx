// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { feedRepo } from '../repo';
import SummaryWidget from '../widgets/SummaryWidget';

const view = () =>
  render(
    <MemoryRouter>
      <SummaryWidget />
    </MemoryRouter>,
  );

describe('feeds widget', () => {
  beforeEach(async () => {
    await db.table('feeds_feed').clear();
  });

  it('shows an empty state with an action when there is no data', async () => {
    view();
    expect(await screen.findByRole('link', { name: 'Feed hinzufügen' })).toHaveAttribute(
      'href',
      '/feeds?new=1',
    );
  });

  it('shows the number of feeds with the number of groups as context', async () => {
    await feedRepo.create({ title: 'A', url: 'https://a.example/f', category: 'Nachrichten' });
    await feedRepo.create({ title: 'B', url: 'https://b.example/f', category: 'Nachrichten' });
    await feedRepo.create({ title: 'C', url: 'https://c.example/f', category: '' });
    view();
    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(screen.getByText('3 Feeds · 1 Gruppe')).toBeInTheDocument();
  });
});
