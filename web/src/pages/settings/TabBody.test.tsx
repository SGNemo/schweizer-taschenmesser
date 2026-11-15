// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { lazy, Suspense, type ComponentType } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PendingSection,
  TAB_SETTLE_MS,
  TAB_SKELETON_AFTER_MS,
  TAB_WAIT_MAX_MS,
  TabBody,
} from './SettingsLayout';

/** A section whose code arrives when the test says so (like a lazy settings chunk). */
function deferredSection(text: string) {
  let resolve!: () => void;
  const ready = new Promise<{ default: ComponentType }>((r) => {
    resolve = () => r({ default: () => <p>{text}</p> });
  });
  const Section = lazy(() => ready);
  return {
    element: (
      <Suspense fallback={<PendingSection />}>
        <Section />
      </Suspense>
    ),
    arrive: async () => {
      resolve();
      // Let the promise settle and React commit the section.
      await act(async () => {
        await ready;
      });
    },
  };
}

const body = (c: HTMLElement) => c.querySelector('[data-shown]')!;
const shown = (c: HTMLElement) => body(c).getAttribute('data-shown') === 'true';
const skeleton = (c: HTMLElement) => c.querySelector('[class*="skeleton"]');
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('settings tab body (sections shown in one piece)', () => {
  it('a tab whose code is already there waits only the settle, then shows its sections', () => {
    const { container } = render(
      <TabBody>
        <p>ready</p>
      </TabBody>,
    );
    expect(shown(container)).toBe(false);
    // Out of sight and out of reach while it waits.
    expect(body(container).getAttribute('aria-hidden')).toBe('true');
    expect(body(container).hasAttribute('inert')).toBe(true);
    expect(body(container).getAttribute('aria-busy')).toBe('true');
    advance(TAB_SETTLE_MS - 1);
    expect(shown(container)).toBe(false);
    advance(1);
    expect(shown(container)).toBe(true);
    expect(body(container).hasAttribute('aria-hidden')).toBe(false);
    expect(body(container).hasAttribute('inert')).toBe(false);
    expect(body(container).getAttribute('aria-busy')).toBe('false');
  });

  it('waits until the last section has its code, then the settle, before it shows anything', async () => {
    const a = deferredSection('A');
    const b = deferredSection('B');
    const { container } = render(
      <TabBody>
        {a.element}
        {b.element}
      </TabBody>,
    );
    advance(TAB_SETTLE_MS * 2);
    expect(shown(container)).toBe(false);
    await a.arrive();
    advance(TAB_SETTLE_MS * 2);
    // One section still waits: the first one does not appear alone and push the rest down later.
    expect(shown(container)).toBe(false);
    await b.arrive();
    advance(TAB_SETTLE_MS - 1);
    expect(shown(container)).toBe(false);
    advance(1);
    expect(shown(container)).toBe(true);
    expect(container.textContent).toContain('A');
    expect(container.textContent).toContain('B');
  });

  it('shows no skeleton for a short wait, and one once the wait is longer', () => {
    const slow = deferredSection('slow');
    const { container } = render(<TabBody>{slow.element}</TabBody>);
    advance(TAB_SKELETON_AFTER_MS - 1);
    expect(skeleton(container)).toBeNull();
    advance(1);
    expect(skeleton(container)).not.toBeNull();
  });

  it('a section that hangs hides the others no longer than the upper bound', () => {
    const hung = deferredSection('never');
    const { container } = render(
      <TabBody>
        <p>other</p>
        {hung.element}
      </TabBody>,
    );
    advance(TAB_WAIT_MAX_MS - 1);
    expect(shown(container)).toBe(false);
    advance(1);
    expect(shown(container)).toBe(true);
    expect(skeleton(container)).toBeNull();
  });

  it('once shown it is never hidden again: a part that loads later appears in place', async () => {
    const late = deferredSection('late');
    const { container, rerender } = render(
      <TabBody>
        <p>first</p>
      </TabBody>,
    );
    advance(TAB_SETTLE_MS);
    expect(shown(container)).toBe(true);
    rerender(
      <TabBody>
        <p>first</p>
        {late.element}
      </TabBody>,
    );
    advance(TAB_WAIT_MAX_MS);
    expect(shown(container)).toBe(true);
    await late.arrive();
    expect(shown(container)).toBe(true);
    expect(container.textContent).toContain('late');
  });
});
