// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { createSeedContext } from '@/core/seed/context';

vi.mock('@/core/mail/accounts', () => ({ listMailAccounts: async () => [] }));

import { threadRepo } from '../repo';
import seedModule from '../seed';
import InboxWidget from '../widgets/InboxWidget';

const wrap = (el: React.ReactNode) => render(<MemoryRouter>{el}</MemoryRouter>);

async function seedDemo() {
  const rows = seedModule.seed(
    createSeedContext({ moduleId: 'mail', today: '2026-10-29', scale: 'medium' }),
  );
  await threadRepo.createMany(rows.thread!.map((r) => ({ id: r.id, data: r.data as never })));
}

beforeEach(async () => {
  await db.table('mail_thread').clear();
});

describe('mail inbox widget', () => {
  it('empty state with a next step when there is no mail', async () => {
    wrap(<InboxWidget />);
    expect(await screen.findByRole('link', { name: 'E-Mail öffnen' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/mail/),
    );
  });

  it('counts unread threads, shows two subject lines and the invoices to add as a context line (from the seed)', async () => {
    await seedDemo();
    wrap(<InboxWidget />);
    expect(await screen.findByText(/^\d+ ungelesen$/)).toBeInTheDocument();
    expect(
      screen.getByText(/Stadtwerke Musterstadt: Ihre Rechnung für Oktober/),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    // „Kopf leer“ 3b: the old count got a verb – the invoices still to add, as the way to the list. The
    // debit mail (nothing to add) does not count; the invoice and the reminder without an open invoice do.
    expect(await screen.findByRole('link', { name: '2 Rechnungen zum Anlegen' })).toHaveAttribute(
      'href',
      '/mail',
    );
  });
});
