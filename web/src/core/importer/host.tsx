import { create } from 'zustand';
import { getManifest } from '@/core/modules/registry';
import { lazy, Suspense, useEffect, type ComponentProps } from 'react';
import { lazyOnline } from '@/core/net/OnlineChunk';
import { useAppImport } from './appImportStore';
import type { OnboardingWizard as Wizard } from './OnboardingWizard';
import type { ImportPreset } from './types';

/** One wizard run: a module and, when files were chosen before, what to read in it. */
// The dialog (source detection, unpacking) is only fetched when someone opens it.
const AppImportHost = lazy(() => import('./appImport').then((m) => ({ default: m.AppImportHost })));
// The wizard (~17 KB gzip) is not part of the start: it is fetched in an idle slot after the start (so the first
// open renders at once, without React's fallback throttle) or, at the latest, when a run opens.
const OnboardingWizard = lazyOnline<ComponentProps<typeof Wizard>>(() =>
  import('./OnboardingWizard').then((m) => ({ default: m.OnboardingWizard })),
);

export interface HostItem {
  moduleId: string;
  preset?: ImportPreset;
}

interface HostState {
  moduleId: string | null;
  preset: ImportPreset | null;
  /** The parts of a multi-part import that follow the open one. */
  queue: HostItem[];
  /** Parts in total (1 for a single run); shown as "Teil 2 von 3". */
  total: number;
  open: (moduleId: string, preset?: ImportPreset) => void;
  /** Several runs one after another (a Takeout ZIP: calendar, then notes, then tasks). */
  openQueue: (items: HostItem[]) => void;
  close: () => void;
}

export const useOnboardingHost = create<HostState>((set, get) => ({
  moduleId: null,
  preset: null,
  queue: [],
  total: 1,
  open: (moduleId, preset) => set({ moduleId, preset: preset ?? null, queue: [], total: 1 }),
  openQueue: (items) => {
    const [first, ...rest] = items;
    if (!first) return;
    set({
      moduleId: first.moduleId,
      preset: first.preset ?? null,
      queue: rest,
      total: items.length,
    });
  },
  close: () => {
    const { queue, preset, total } = get();
    const [next, ...rest] = queue;
    if (next) {
      set({ moduleId: next.moduleId, preset: next.preset ?? null, queue: rest });
      return;
    }
    set({ moduleId: null, preset: null, queue: [], total: 1 });
    // The last part of a run with several parts: the sheet shows the run and can undo all of it.
    if (total > 1 && preset?.groupId) useAppImport.getState().showRun(preset.groupId);
  },
}));

/**
 * The one wizard dialog of the app. It lives outside the pages on purpose: the "start data" buttons
 * sit in empty states that disappear as soon as the first entry is imported, which would tear the
 * dialog (and its result step) down with them.
 */
export function OnboardingHost() {
  const { moduleId, preset, queue, total, close } = useOnboardingHost();
  const manifest = moduleId ? getManifest(moduleId) : undefined;
  const appImportOpen = useAppImport((s) => s.open);
  useEffect(() => {
    const idle = window.requestIdleCallback?.bind(window);
    if (!idle) {
      const id = window.setTimeout(() => void OnboardingWizard.preload(), 2000);
      return () => window.clearTimeout(id);
    }
    const id = idle(() => void OnboardingWizard.preload(), { timeout: 5000 });
    return () => window.cancelIdleCallback(id);
  }, []);
  return (
    <>
      {manifest ? (
        <Suspense fallback={null}>
          <OnboardingWizard
            // A new part is a new wizard: its own state, its own batch id.
            key={`${moduleId}-${queue.length}`}
            manifest={manifest}
            open
            onClose={close}
            preset={preset ?? undefined}
            part={total > 1 ? { index: total - queue.length, total } : undefined}
          />
        </Suspense>
      ) : null}
      {appImportOpen ? (
        <Suspense fallback={null}>
          <AppImportHost />
        </Suspense>
      ) : null}
    </>
  );
}
