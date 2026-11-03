// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OverlayScroll } from './OverlayScroll';

/** jsdom has no layout: give the viewport the sizes a real one would report. */
function size(
  el: HTMLElement,
  sizes: { clientHeight: number; scrollHeight: number; scrollTop?: number },
) {
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: sizes.clientHeight });
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: sizes.scrollHeight });
  el.scrollTop = sizes.scrollTop ?? 0;
}
const viewportOf = (root: HTMLElement) => root.firstElementChild as HTMLElement;

describe('OverlayScroll (identity v3 scrollbars)', () => {
  it('shows no thumb and no fade while everything fits', () => {
    render(
      <OverlayScroll>
        <p>kurz</p>
      </OverlayScroll>,
    );
    const wrap = screen.getByTestId('overlay-scroll');
    expect(wrap).not.toHaveAttribute('data-scrollable');
    expect(screen.queryByTestId('overlay-thumb')).toBeNull();
  });

  it('fades the bottom edge at the top, both in the middle, the top at the end; the thumb follows', () => {
    render(
      <OverlayScroll>
        <p>lang</p>
      </OverlayScroll>,
    );
    const wrap = screen.getByTestId('overlay-scroll');
    const viewport = viewportOf(wrap);
    size(viewport, { clientHeight: 200, scrollHeight: 800 });
    act(() => void fireEvent.scroll(viewport));
    expect(wrap).toHaveAttribute('data-scrollable', 'true');
    expect(wrap).not.toHaveAttribute('data-top');
    expect(wrap).toHaveAttribute('data-bottom', 'true');
    const thumb = screen.getByTestId('overlay-thumb');
    // 200 of 800 visible: a quarter of the track, at its start.
    expect(thumb).toHaveStyle({ height: '50px', transform: 'translateY(0px)' });

    size(viewport, { clientHeight: 200, scrollHeight: 800, scrollTop: 300 });
    act(() => void fireEvent.scroll(viewport));
    expect(wrap).toHaveAttribute('data-top', 'true');
    expect(wrap).toHaveAttribute('data-bottom', 'true');
    expect(screen.getByTestId('overlay-thumb')).toHaveStyle({ transform: 'translateY(75px)' });

    size(viewport, { clientHeight: 200, scrollHeight: 800, scrollTop: 600 });
    act(() => void fireEvent.scroll(viewport));
    expect(wrap).toHaveAttribute('data-top', 'true');
    expect(wrap).not.toHaveAttribute('data-bottom');
    expect(screen.getByTestId('overlay-thumb')).toHaveStyle({ transform: 'translateY(150px)' });
  });

  it('keeps the thumb at least 24 px tall and hidden from assistive technology', () => {
    render(
      <OverlayScroll>
        <p>sehr lang</p>
      </OverlayScroll>,
    );
    const wrap = screen.getByTestId('overlay-scroll');
    size(viewportOf(wrap), { clientHeight: 100, scrollHeight: 10000 });
    act(() => void fireEvent.scroll(viewportOf(wrap)));
    const thumb = screen.getByTestId('overlay-thumb');
    expect(thumb).toHaveStyle({ height: '24px' });
    expect(thumb).toHaveAttribute('aria-hidden', 'true');
  });
});
