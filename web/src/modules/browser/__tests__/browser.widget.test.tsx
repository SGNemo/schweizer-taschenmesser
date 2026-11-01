// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { validateManifest } from '@/core/modules/registry';
import manifest from '../manifest';
import { bookmarkRepo } from '../repo';
import BookmarksWidget from '../widgets/BookmarksWidget';

const view = () =>
  render(
    <MemoryRouter>
      <BookmarksWidget />
    </MemoryRouter>,
  );

describe('browser module', () => {
  beforeEach(async () => {
    await db.table('browser_bookmark').clear();
  });

  it('has a valid manifest', () => {
    expect(validateManifest(manifest)).toEqual([]);
  });

  it('widget: empty state offers the browser', async () => {
    view();
    expect(await screen.findByRole('link', { name: /Browser öffnen/ })).toHaveAttribute('href', '/browser');
  });

  it('widget: lists saved pages', async () => {
    await bookmarkRepo.create({ title: 'Beispiel-Wetter', url: 'https://wetter.example.org/' });
    view();
    expect(await screen.findByText('Beispiel-Wetter')).toBeInTheDocument();
  });
});
