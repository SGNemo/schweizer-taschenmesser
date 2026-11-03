// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setPlatform } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { ReaderPanel } from '../components/ReaderPanel';
import { TabOverview } from '../components/TabOverview';
import { settings as moduleSettings } from '../settings';
import type { Tab } from '../tabsStore';

const tab = (over: Partial<Tab>): Tab => ({
  id: 1,
  url: 'https://news.example.org/a',
  title: 'Eine Seite',
  loading: false,
  isPrivate: false,
  zoom: 1,
  opened: true,
  held: null,
  blocked: 0,
  hosts: [],
  ...over,
});

describe('TabOverview', () => {
  const noop = () => {};
  it('shows title, site and a monogram; a picture only where one is given and never for private tabs', () => {
    render(
      <TabOverview
        tabs={[
          tab({ id: 1 }),
          tab({ id: 2, url: 'https://shop.example.org/', title: 'Shop' }),
          tab({ id: 3, isPrivate: true, url: 'https://secret.example.org/', title: 'Geheim' }),
        ]}
        activeId={1}
        previews={{
          'https://shop.example.org/': 'blob:shop',
          'https://secret.example.org/': 'blob:secret',
        }}
        onPick={noop}
        onClose={noop}
        onNew={noop}
      />,
    );
    const cards = screen.getAllByTestId('tab-card');
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent('Eine Seite');
    expect(cards[0]).toHaveTextContent('news.example.org');
    expect(cards[0]!.querySelector('img')).toBeNull();
    expect(cards[1]!.querySelector('img')).toHaveAttribute('src', 'blob:shop');
    expect(cards[2]).toHaveTextContent('Privat');
    expect(cards[2]!.querySelector('img')).toBeNull();
    expect(cards[0]!.querySelector('[aria-current="page"]')).not.toBeNull();
  });

  it('picks and closes with one click each', async () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(
      <TabOverview
        tabs={[tab({ id: 7 })]}
        activeId={null}
        previews={{}}
        onPick={onPick}
        onClose={onClose}
        onNew={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /^Eine Seite/ }));
    expect(onPick).toHaveBeenCalledWith(7);
    await userEvent.click(screen.getByRole('button', { name: 'Tab schließen: Eine Seite' }));
    expect(onClose).toHaveBeenCalledWith(7);
  });
});

describe('ReaderPanel', () => {
  afterEach(() => setPlatform(undefined));
  const nativeWith = (body: string, type = 'text/html') =>
    setPlatform({
      ...createWebPlatform(),
      kind: 'desktop',
      isNative: true,
      fetch: (async () =>
        new Response(body, { status: 200, headers: { 'content-type': type } })) as typeof fetch,
    });

  it('shows the article as plain text, never as markup or script', async () => {
    nativeWith(
      `<article><h1>Titel</h1><p onclick="x()">Ein langer Absatz mit Text. ${'Mehr. '.repeat(40)}<script>alert(1)</script></p></article>`,
    );
    const { container } = render(
      <ReaderPanel url="https://news.example.org/a" onBack={() => {}} />,
    );
    await waitFor(() => expect(screen.getByRole('article')).toBeInTheDocument());
    expect(screen.getByRole('article')).toHaveTextContent('Ein langer Absatz mit Text.');
    expect(container.querySelector('script, [onclick], iframe')).toBeNull();
    expect(container.innerHTML).not.toContain('alert(1)');
  });

  it('says so when the page is not article-like', async () => {
    nativeWith('<p>Hallo</p>');
    render(<ReaderPanel url="https://news.example.org/a" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText(/nicht als Text lesen/)).toBeInTheDocument());
  });
});

describe('settings and isolation', () => {
  it('tab previews are off by default', () => {
    expect(moduleSettings.defaults).toMatchObject({ tabPreview: false });
  });

  it('the module never reaches into a tab: no script injection, no Tauri import, no page content read', () => {
    const sources = import.meta.glob(['../**/*.ts', '../**/*.tsx', '!../**/__tests__/**'], {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;
    expect(Object.keys(sources).length).toBeGreaterThan(5);
    for (const [file, code] of Object.entries(sources)) {
      expect(code, file).not.toMatch(/@tauri-apps|core\/platform\/tauri/);
      expect(code, file).not.toMatch(
        /\beval\s*\(|executeScript|evaluateScript|injectScript|initialization_script/,
      );
    }
  });
});
