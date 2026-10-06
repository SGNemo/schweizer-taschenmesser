// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { t } from '@/strings';
import { threadRepo } from '../repo';
import RecentChatsWidget from '../widgets/RecentChatsWidget';

const view = () =>
  render(
    <MemoryRouter>
      <RecentChatsWidget />
    </MemoryRouter>,
  );

describe('chat widget', () => {
  beforeEach(async () => {
    await db.table('chat_thread').clear();
  });

  it('shows an empty state with an action when there is no chat', async () => {
    view();
    expect(await screen.findByRole('link', { name: t.homeEmpty.chat })).toHaveAttribute(
      'href',
      '/chat?new=1',
    );
  });

  it('lists chat titles, pinned first, archived hidden', async () => {
    const base = {
      autoTitle: false,
      pinned: false,
      archived: false,
      engine: 'router' as const,
      contextModules: [],
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
    };
    await threadRepo.create({ ...base, title: 'Normal' });
    await threadRepo.create({ ...base, title: 'Wichtig', pinned: true });
    await threadRepo.create({ ...base, title: 'Alt', archived: true });
    view();
    expect(await screen.findByText('Wichtig')).toBeInTheDocument();
    expect(screen.getByText('Normal')).toBeInTheDocument();
    expect(screen.queryByText('Alt')).toBeNull();
  });
});
