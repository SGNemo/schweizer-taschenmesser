// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import type * as PublicFetch from '@/core/net/fetchPublic';
import { t } from '@/strings';
import { feedRepo } from '../repo';
import MainPage from '../routes/MainPage';

const fetchPublic = vi.hoisted(() => vi.fn());
vi.mock('@/core/net/fetchPublic', async (orig) => ({
  ...(await orig<typeof PublicFetch>()),
  fetchPublic,
}));

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>Werkstatt-Blog</title>
<item><title>Neues Regal</title><link>https://blog.example.org/regal</link><pubDate>Sun, 01 Nov 2026 10:00:00 GMT</pubDate></item>
</channel></rss>`;
const PAGE = `<head><link rel="alternate" type="application/rss+xml" href="/feed.xml"></head>`;

const view = (url = '/feeds?new=1') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <MainPage />
    </MemoryRouter>,
  );

describe('feeds: look before subscribing', () => {
  beforeEach(async () => {
    await db.table('feeds_feed').clear();
    fetchPublic.mockReset();
  });

  it('never goes online before a click', async () => {
    view();
    await screen.findByRole('searchbox', { name: t.feeds.find.query });
    expect(fetchPublic).not.toHaveBeenCalled();
  });

  it('a website address finds its feed, shows the newest articles and subscribes', async () => {
    fetchPublic.mockImplementation(async (url: string, _i: unknown, _t: unknown, kind: string) => {
      if (kind === 'page') return new Response(PAGE);
      return url.endsWith('/feed.xml') ? new Response(RSS) : new Response('x', { status: 415 });
    });
    const user = userEvent.setup();
    view();
    await user.type(
      await screen.findByRole('searchbox', { name: t.feeds.find.query }),
      'blog.example.org',
    );
    expect(fetchPublic).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: t.feeds.find.preview }));
    expect(await screen.findByRole('heading', { name: 'Werkstatt-Blog' })).toBeInTheDocument();
    expect(screen.getByText('Neues Regal')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.feeds.preview.subscribe }));
    await waitFor(async () => expect(await feedRepo.active().count()).toBe(1));
    const [feed] = await feedRepo.active().toArray();
    expect(feed).toMatchObject({
      title: 'Werkstatt-Blog',
      url: 'https://blog.example.org/feed.xml',
      siteUrl: 'https://blog.example.org/',
    });
  });

  it('without a way online it says so calmly and still lets you add the address', async () => {
    const { PublicFetchError } = await import('@/core/net/fetchPublic');
    fetchPublic.mockRejectedValue(new PublicFetchError('no-proxy'));
    const user = userEvent.setup();
    view();
    await user.type(
      await screen.findByRole('searchbox', { name: t.feeds.find.query }),
      'blog.example.org{Enter}',
    );
    expect(await screen.findByText(t.feeds.preview.noProxy)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.feeds.preview.anyway }));
    expect(await screen.findByRole('textbox', { name: t.feeds.fields.url })).toHaveValue(
      'https://blog.example.org/',
    );
  });

  it('a tap on a catalogue name previews it; subscribing keeps the catalogue group', async () => {
    fetchPublic.mockResolvedValue(new Response(RSS));
    const user = userEvent.setup();
    view();
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: /^heise online(?! abonnieren)/,
      }),
    );
    await screen.findByTestId('feeds-preview');
    await user.click(screen.getByRole('button', { name: t.feeds.preview.subscribe }));
    await waitFor(async () => expect(await feedRepo.active().count()).toBe(1));
    expect((await feedRepo.active().toArray())[0]).toMatchObject({
      title: 'heise online',
      category: t.feeds.catalog.categories.tech,
    });
  });
});
