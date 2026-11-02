// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { createSeedContext } from '@/core/seed/context';

vi.mock('@/core/mail/accounts', () => ({ listMailAccounts: async () => [] }));

import { threadRepo } from '../repo';
import seedModule from '../seed';
import InvoicesWidget from '../widgets/InvoicesWidget';
import TopWidget from '../widgets/TopWidget';
import UnreadWidget from '../widgets/UnreadWidget';

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

describe('mail widgets', () => {
  it.each([
    ['unread', UnreadWidget],
    ['top', TopWidget],
    ['invoices', InvoicesWidget],
  ] as const)('%s: empty state with a next step when there is no mail', async (_n, Widget) => {
    wrap(<Widget />);
    expect(await screen.findByRole('link', { name: 'E-Mail öffnen' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/mail/),
    );
  });

  it('count unread threads, list the top three and spot invoice mails (from the seed)', async () => {
    await seedDemo();
    wrap(
      <>
        <UnreadWidget />
        <TopWidget />
        <InvoicesWidget />
      </>,
    );
    expect(await screen.findByText('Ungelesene Threads im Posteingang')).toBeInTheDocument();
    expect(
      screen.getByText(/Stadtwerke Musterstadt: Ihre Rechnung für Oktober/),
    ).toBeInTheDocument();
    expect(screen.getByText('Rechnungsmails')).toBeInTheDocument();
    expect(screen.getByText('in den letzten 30 Tagen')).toBeInTheDocument();
  });
});
