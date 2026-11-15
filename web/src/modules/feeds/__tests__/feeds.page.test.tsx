// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { t } from '@/strings';
import { feedRepo } from '../repo';
import MainPage from '../routes/MainPage';

const view = (url = '/feeds') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <MainPage />
    </MemoryRouter>,
  );

describe('feeds page: adding made easy', () => {
  beforeEach(async () => {
    await db.table('feeds_feed').clear();
  });

  it('the empty page offers three suggestions; one tap subscribes', async () => {
    const user = userEvent.setup();
    view();
    const box = await screen.findByTestId('feeds-suggestions');
    const adds = within(box).getAllByRole('button', { name: /hinzufügen/ });
    expect(adds).toHaveLength(3);
    await user.click(screen.getByTestId('feeds-catalog-add-tagesschau'));
    await waitFor(async () => expect(await feedRepo.active().count()).toBe(1));
    const [feed] = await feedRepo.active().toArray();
    expect(feed).toMatchObject({
      title: 'tagesschau.de',
      category: t.feeds.catalog.categories.news,
      url: 'https://www.tagesschau.de/index~rss2.xml',
    });
  });

  it('the add dialog searches the catalogue and marks what is subscribed', async () => {
    await feedRepo.create({
      title: 'heise online',
      url: 'https://www.heise.de/rss/heise-atom.xml',
      category: '',
    });
    const user = userEvent.setup();
    view('/feeds?new=1');
    const field = await screen.findByRole('searchbox', { name: t.feeds.find.query });
    await user.type(field, 'heise');
    expect(await screen.findByTestId('feeds-catalog-added-heise')).toBeInTheDocument();
    await user.clear(field);
    await user.type(field, 'gibtesnicht');
    expect(await screen.findByTestId('feeds-catalog-none')).toBeInTheDocument();
  });

  it('a shared address opens the dialog with it and goes on to the form', async () => {
    const user = userEvent.setup();
    view(`/feeds?add=${encodeURIComponent('https://blog.example.org/')}`);
    await user.click(await screen.findByRole('button', { name: t.feeds.find.addAddress }));
    expect(await screen.findByRole('textbox', { name: t.feeds.fields.url })).toHaveValue(
      'https://blog.example.org/',
    );
  });
});
