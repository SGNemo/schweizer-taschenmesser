// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { usePageChrome, usePageChromeStore } from './pageChrome';

function Page({ menu }: { menu: boolean }) {
  usePageChrome({ writeInMenu: menu, advancedInMenu: true });
  return null;
}

afterEach(cleanup);

describe('page chrome', () => {
  it('is empty by default, set while the page is mounted and reset when it goes away', () => {
    expect(usePageChromeStore.getState().chrome).toEqual({
      writeInMenu: false,
      advancedInMenu: false,
    });
    const view = render(<Page menu />);
    expect(usePageChromeStore.getState().chrome).toEqual({
      writeInMenu: true,
      advancedInMenu: true,
    });
    view.rerender(<Page menu={false} />);
    expect(usePageChromeStore.getState().chrome.writeInMenu).toBe(false);
    // Identity 4.0: there is no round "+" button a page could hide; its wish is gone from the contract.
    expect(usePageChromeStore.getState().chrome).not.toHaveProperty('hideFab');
    view.unmount();
    expect(usePageChromeStore.getState().chrome).toEqual({
      writeInMenu: false,
      advancedInMenu: false,
    });
  });
});
