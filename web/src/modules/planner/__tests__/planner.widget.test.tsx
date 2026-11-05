// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { entryRepo } from '../repo';
import SummaryWidget from '../widgets/SummaryWidget';

const view = () =>
  render(
    <MemoryRouter>
      <SummaryWidget />
    </MemoryRouter>,
  );

describe('planner widget', () => {
  beforeEach(async () => {
    await db.table('planner_entry').clear();
  });

  it('shows an empty state with an action when there is no data', async () => {
    view();
    expect(await screen.findByRole('link', { name: /anlegen/ })).toHaveAttribute(
      'href',
      '/planner?new=1',
    );
  });

  it('lists open entries', async () => {
    await entryRepo.create({ title: 'Beispiel', done: false });
    view();
    expect(await screen.findByText('Beispiel')).toBeInTheDocument();
  });
});
