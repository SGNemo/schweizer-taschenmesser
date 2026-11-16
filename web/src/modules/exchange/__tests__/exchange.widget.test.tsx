// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { itemRepo } from '../repo';
import ExchangeWidget from '../widgets/ExchangeWidget';

const view = () =>
  render(
    <MemoryRouter>
      <ExchangeWidget />
    </MemoryRouter>,
  );

describe('exchange widget', () => {
  beforeEach(async () => {
    await db.table('exchange_item').clear();
  });

  it('says where it works when this device has no channel (browser)', async () => {
    view();
    expect(await screen.findByText(/Desktop-App und auf dem Handy/)).toBeInTheDocument();
  });

  it('counts nothing that only grows: unseen cards only', async () => {
    await itemRepo.create({
      peer: 'pc',
      itemId: 'e'.repeat(32),
      direction: 'in',
      kind: 'text',
      body: 'x',
      state: 'received',
      unseen: false,
    });
    const rows = await itemRepo
      .active()
      .filter((r) => r.unseen)
      .count();
    expect(rows).toBe(0);
  });
});
