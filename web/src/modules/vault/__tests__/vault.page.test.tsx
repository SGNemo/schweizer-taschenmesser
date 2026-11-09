// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { addDaysStr, today } from '@/core/time/dates';
import { documentRepo } from '../repo';
import VaultPage from '../routes/VaultPage';

describe('vault page cards (U53)', () => {
  beforeEach(async () => {
    await db.table('vault_document').clear();
  });

  it('keeps a date in one piece: the end date is its own no-wrap span inside the meta line', async () => {
    await documentRepo.create({
      title: 'Laptop Garantie',
      category: 'warranty',
      provider: 'Technikhaus Lindner',
      endDate: addDaysStr(today(), 200),
    } as never);
    render(
      <MemoryRouter>
        <VaultPage />
      </MemoryRouter>,
    );
    const end = await screen.findByText(/^Ende: /);
    expect(end.tagName).toBe('SPAN');
    expect(end.className).toMatch(/nowrap/);
    expect(end.closest('li')).toHaveTextContent('Technikhaus Lindner');
  });
});
