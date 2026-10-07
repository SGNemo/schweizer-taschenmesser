import { loadSeed } from '@/core/seed/load';
import { useUiStore } from '@/stores/ui';
import { tDev } from '@/strings.dev';
import type { Command } from './CommandPalette';

/** Palette commands of the Dev-Preview: fill the app with test data or take it out again. */
export function devCommands(): Command[] {
  const toast = useUiStore.getState().toast;
  return [
    {
      id: 'dev-seed-load',
      label: tDev.palette.load,
      icon: 'plus',
      run: () =>
        void loadSeed?.()
          .then((m) => m.applySeed({ scale: 'medium' }))
          .then(() => toast(tDev.palette.loaded)),
    },
    {
      id: 'dev-seed-remove',
      label: tDev.palette.remove,
      icon: 'trash',
      run: () =>
        void loadSeed?.()
          .then((m) => m.removeSeed())
          .then(() => toast(tDev.palette.removed)),
    },
  ];
}
