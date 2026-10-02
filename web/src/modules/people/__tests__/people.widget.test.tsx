// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { giftRepo, personRepo } from '../repo';
import NextBirthdaysWidget from '../widgets/NextBirthdaysWidget';

const view = () =>
  render(
    <MemoryRouter>
      <NextBirthdaysWidget />
    </MemoryRouter>,
  );

describe('people widget', () => {
  beforeEach(async () => {
    await db.table('people_person').clear();
    await db.table('people_gift').clear();
  });

  it('shows an empty state with an action when there is no data', async () => {
    view();
    expect(await screen.findByRole('link', { name: /anlegen/ })).toHaveAttribute(
      'href',
      '/people?new=1',
    );
  });

  it('lists the next birthdays and says how many gifts are open', async () => {
    const anna = await personRepo.create({
      name: 'Anna',
      birthday: { month: 10, day: 3 },
      tags: [],
    });
    await giftRepo.create({ personId: anna.id, title: 'Buch', status: 'idea' });
    await giftRepo.create({ personId: anna.id, title: 'Schal', status: 'given' });
    view();
    expect(await screen.findByText('Anna')).toBeInTheDocument();
    expect(screen.getByText('1 Geschenk offen')).toBeInTheDocument();
  });
});
