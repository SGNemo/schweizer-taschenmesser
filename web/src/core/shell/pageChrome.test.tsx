// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { usePageChrome, usePageChromeStore } from './pageChrome';

function Page({ fab }: { fab: boolean }) {
  usePageChrome({ hideFab: fab, writeInMenu: true });
  return null;
}

afterEach(cleanup);

describe('page chrome', () => {
  it('is empty by default, set while the page is mounted and reset when it goes away', () => {
    expect(usePageChromeStore.getState().chrome).toEqual({ hideFab: false, writeInMenu: false });
    const view = render(<Page fab />);
    expect(usePageChromeStore.getState().chrome).toEqual({ hideFab: true, writeInMenu: true });
    view.rerender(<Page fab={false} />);
    expect(usePageChromeStore.getState().chrome.hideFab).toBe(false);
    view.unmount();
    expect(usePageChromeStore.getState().chrome).toEqual({ hideFab: false, writeInMenu: false });
  });
});
