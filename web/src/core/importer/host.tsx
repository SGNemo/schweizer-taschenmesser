import { create } from 'zustand';
import { getManifest } from '@/core/modules/registry';
import { lazy, Suspense } from 'react';
import { useAppImport } from './appImportStore';
import { OnboardingWizard } from './OnboardingWizard';
import type { ImportPreset } from './types';

/** One wizard run: a module and, when files were chosen before, what to read in it. */
// The dialog (source detection, unpacking) is only fetched when someone opens it.
const AppImportHost = lazy(() => import('./appImport').then((m) => ({ default: m.AppImportHost })));

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
  return (
    <>
      {manifest ? (
        <OnboardingWizard
          // A new part is a new wizard: its own state, its own batch id.
          key={`${moduleId}-${queue.length}`}
          manifest={manifest}
          open
          onClose={close}
          preset={preset ?? undefined}
          part={total > 1 ? { index: total - queue.length, total } : undefined}
        />
      ) : null}
      {appImportOpen ? (
        <Suspense fallback={null}>
          <AppImportHost />
        </Suspense>
      ) : null}
    </>
  );
}
