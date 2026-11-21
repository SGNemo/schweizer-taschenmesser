// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { t } from '@/strings';
import { feedRepo } from '../repo';
import { typedAddress } from '../routes/AddDialog';
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
    const adds = within(box).getAllByRole('button', { name: /abonnieren/ });
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

  it('a row links to the site only when that is a web address, otherwise to the feed', async () => {
    await feedRepo.create({
      title: 'Importiert',
      url: 'https://feed.example.org/rss.xml',
      category: '',
      siteUrl: 'ms-settings:network-status',
    });
    await feedRepo.create({
      title: 'Mit Seite',
      url: 'https://other.example.org/rss.xml',
      category: '',
      siteUrl: 'https://other.example.org/',
    });
    view();
    const odd = await screen.findByRole('link', { name: /Importiert/ });
    expect(odd).toHaveAttribute('href', 'https://feed.example.org/rss.xml');
    expect(screen.getByRole('link', { name: /Mit Seite/ })).toHaveAttribute(
      'href',
      'https://other.example.org/',
    );
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

  it('a quick double tap subscribes once', async () => {
    const user = userEvent.setup();
    view();
    const add = await screen.findByTestId('feeds-catalog-add-tagesschau');
    await user.dblClick(add);
    await waitFor(async () => expect(await feedRepo.active().count()).toBe(1));
    await new Promise((r) => setTimeout(r, 50));
    expect(await feedRepo.active().count()).toBe(1);
  });

  it('a feed removed after a one-tap subscribe can be subscribed again', async () => {
    const user = userEvent.setup();
    view();
    await user.click(await screen.findByTestId('feeds-catalog-add-tagesschau'));
    await waitFor(async () => expect(await feedRepo.active().count()).toBe(1));
    const [feed] = await feedRepo.active().toArray();
    await feedRepo.remove(feed!.id);
    await user.click(await screen.findByTestId('feeds-catalog-add-tagesschau'));
    await waitFor(async () => expect(await feedRepo.active().count()).toBe(1));
  });

  it('reads an address only where it ends in a top-level domain', () => {
    expect(typedAddress('heise.de')).toBe('https://heise.de/');
    expect(typedAddress('u.s.')).toBeUndefined();
    expect(typedAddress('192.168.1.20/rss')).toBe('https://192.168.1.20/rss');
    expect(typedAddress('wetter morgen')).toBeUndefined();
  });
});
