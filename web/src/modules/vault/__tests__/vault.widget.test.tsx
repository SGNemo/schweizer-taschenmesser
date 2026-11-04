// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { addDaysStr, today } from '@/core/time/dates';
import { documentRepo } from '../repo';
import ExpiringWidget from '../widgets/ExpiringWidget';

describe('vault widget', () => {
  beforeEach(async () => {
    await db.table('vault_document').clear();
  });

  it('shows counts per state and never a document title, provider or file name', async () => {
    await documentRepo.create({
      title: 'Reisepass Anna',
      category: 'identity',
      provider: 'Bürgeramt Nord',
      fileName: 'pass-scan.pdf',
      endDate: addDaysStr(today(), -3),
    } as never);
    render(
      <MemoryRouter>
        <ExpiringWidget />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Abgelaufen')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    const text = document.body.textContent ?? '';
    for (const secret of ['Reisepass', 'Anna', 'Bürgeramt', 'pass-scan'])
      expect(text).not.toContain(secret);
  });

  it('keeps its calm empty state when nothing needs a look', async () => {
    render(
      <MemoryRouter>
        <ExpiringWidget />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('link', { name: /anlegen|Unterlage/i })).toBeInTheDocument();
  });
});
