// @vitest-environment jsdom
/**
 * Page title contract for every module route (UI audit 2026-11, package 0a-1b; new modules and routes are
 * picked up automatically): the real page, rendered in the module frame as the router does it, puts exactly
 * one `<h1>` on the screen, and it is the `PageTitle` in the title slot of the head (`PageHeader` hands it
 * over). The source side of the same promise is `scripts/lib/ownH1.test.ts` (no own `<h1>` in a route).
 */
import { Suspense } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isFocusPath } from '@/core/focus/path';
import { enableModule } from '@/core/modules/activation';
import { frameVariant } from '@/core/modules/frame';
import { lazyComponent } from '@/core/modules/lazy';
import { visibleManifests } from '@/core/modules/registry';
import { setPlatform } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { setNow } from '@/core/time/now';
import { useDiskStore } from '@/modules/disk/store';
import { AreaFrame, ModulePageFallback } from './AreaFrame';
import { ModuleErrorBoundary } from './ModuleErrorBoundary';

const all = visibleManifests.flatMap((m) => m.routes.map((r) => [r.path, m, r] as const));
/** A parameter gets a value nothing is stored under: the page still names itself. */
const urlOf = (path: string): string => path.replace(/\/\*$/, '').replace(/:\w+/g, 'none');
/**
 * Focus mode (`/<module>/focus/…`) is the one kind of route without the module head: the frame steps back
 * (`AreaFrame`), the page writes its own title (counted in `scripts/baselines/own-h1.json`).
 */
const frameless = all.filter(([path]) => isFocusPath(urlOf(path)));
const framed = all.filter(([path]) => !isFocusPath(urlOf(path)));

/** Routes that leave at once without state of their own. */
const PREPARE: Readonly<Record<string, () => void>> = {
  // The scan page shows a scan that is running or done; without one it goes back to the drives.
  '/disk/scan': () => useDiskStore.setState({ phase: 'scanning', root: 'C:\\' }),
};

beforeAll(async () => {
  setNow(() => new Date(2026, 8, 29, 10, 0).getTime());
  // Desktop: the modules that exist only there have a route and a head too.
  setPlatform({ ...createWebPlatform(), kind: 'desktop' });
  for (const m of visibleManifests) await enableModule(m);
});
afterAll(() => {
  setNow();
  setPlatform(undefined);
});

function renderRoute([path, m, r]: (typeof all)[number]) {
  // A module of other platforms only (the phone's remote control) is framed on its own platform.
  const kind = !m.platforms || m.platforms.includes('desktop') ? 'desktop' : m.platforms[0]!;
  setPlatform({ ...createWebPlatform(), kind });
  PREPARE[path]?.();
  const Page = lazyComponent(r.component);
  return render(
    <MemoryRouter initialEntries={[urlOf(path)]}>
      <AreaFrame variant={frameVariant(r.layout ?? m.layout)} hue={m.identity.hue} route={r.path}>
        <ModuleErrorBoundary manifest={m}>
          <Suspense fallback={<ModulePageFallback manifest={m} />}>
            <Page />
          </Suspense>
        </ModuleErrorBoundary>
      </AreaFrame>
    </MemoryRouter>,
  );
}

describe('every module route renders exactly one PageTitle h1, in the title slot of the head', () => {
  it('covers every module, and only focus mode is without a head', () => {
    expect(new Set(framed.map(([, m]) => m.id)).size).toBe(visibleManifests.length);
    expect(frameless.map(([path]) => path).sort()).toEqual([
      '/planner/focus/:item',
      '/todos/focus/:taskId',
    ]);
    for (const path of Object.keys(PREPARE))
      expect(
        framed.map(([p]) => p),
        `PREPARE names a route that is gone: ${path}`,
      ).toContain(path);
  });

  it.each(framed)(
    '%s',
    async (...route) => {
      const { container } = renderRoute(route);
      const frame = await screen.findByTestId('module-frame');
      const h1s = () => [...container.ownerDocument.querySelectorAll('h1')];
      await waitFor(
        () => expect(within(frame).getAllByRole('heading', { level: 1 })).toHaveLength(1),
        { timeout: 10_000 },
      );
      const [title] = within(frame).getAllByRole('heading', { level: 1 });
      // PageTitle renders a bare <h1> straight into the frame's title slot, which the frame marks as such: an
      // <h1> of the page's own, anywhere else in the head, does not pass.
      expect(title!.attributes, 'the h1 of PageTitle carries no attributes').toHaveLength(0);
      const slots = frame.querySelectorAll('[data-slot="title"]');
      expect(slots, 'the head has exactly one title slot').toHaveLength(1);
      expect(title!.parentElement, 'the h1 sits in the title slot of the head').toBe(slots[0]);
      expect(title!.textContent!.trim()).not.toBe('');
      // Exactly one on the whole screen: none below the head, none in a second place.
      expect(h1s()).toEqual([title]);
    },
    20_000,
  );

  it.each(frameless)('%s (focus mode): no module head, so no title slot', async (...route) => {
    renderRoute(route);
    await waitFor(() => expect(document.body.textContent!.trim()).not.toBe(''));
    expect(screen.queryByTestId('module-frame')).toBeNull();
  });
});
