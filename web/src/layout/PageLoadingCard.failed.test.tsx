// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as platform from '@/core/platform';
import { setLangPref } from '@/core/i18n/lang';
import { PageLoadingCard } from './PageLoadingCard';

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await setLangPref('de');
});

/**
 * The page's code did not arrive (the error boundary renders the card with `failed`): nothing is loading any more,
 * so the card must not promise that "it continues here" nor say "still loading" once the connection is back
 * (UI audit 2026-11, Advocate R2-F3).
 */
describe('PageLoadingCard, code did not arrive', () => {
  it('offline in the browser: promises a reload once online, not that it continues by itself', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(<PageLoadingCard failed />);
    const card = screen.getByTestId('page-loading-card');
    expect(card).toHaveTextContent('Sobald du wieder online bist, kannst du sie hier neu laden.');
    expect(card).not.toHaveTextContent('geht es hier weiter');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('back online: says so and offers "Neu laden" instead of "Die Seite lädt noch"', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(<PageLoadingCard failed />);
    act(() => void window.dispatchEvent(new Event('online')));
    const card = screen.getByTestId('page-loading-card');
    expect(card).toHaveTextContent('Du bist wieder online.');
    expect(card).not.toHaveTextContent('lädt noch');
    expect(screen.getByRole('button', { name: 'Neu laden' })).toBeInTheDocument();
  });

  it('a page that is only slow keeps its wording: it does continue, and online again it is still loading', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(<PageLoadingCard />);
    expect(screen.getByTestId('page-loading-card')).toHaveTextContent('geht es hier weiter');
    act(() => void window.dispatchEvent(new Event('online')));
    expect(screen.getByTestId('page-loading-card')).toHaveTextContent('Die Seite lädt noch.');
  });

  it('in the desktop app nothing waits for the network: "Neu laden" stays, also after an online event', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    vi.spyOn(platform, 'getPlatform').mockReturnValue({ kind: 'desktop' } as ReturnType<
      typeof platform.getPlatform
    >);
    render(<PageLoadingCard failed />);
    act(() => void window.dispatchEvent(new Event('online')));
    const card = screen.getByTestId('page-loading-card');
    expect(card).toHaveTextContent('Die Seite lädt noch.');
    expect(card).not.toHaveTextContent('online');
    expect(screen.getByRole('button', { name: 'Neu laden' })).toBeInTheDocument();
  });

  it('English', async () => {
    await setLangPref('en');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(<PageLoadingCard failed />);
    const card = screen.getByTestId('page-loading-card');
    expect(card).toHaveTextContent('As soon as you are back online, you can reload it here.');
    act(() => void window.dispatchEvent(new Event('online')));
    expect(card).toHaveTextContent('You are back online.');
  });
});
