import { useLiveQuery } from 'dexie-react-hooks';
import { useBackClose as useShellBackClose } from '@/core/shell/useBackClose';
import { readSetupState, type SetupState } from './state';

/** Live setup state: `undefined` while loading, `null` before the start migration ran. */
export function useSetupState(): SetupState | null | undefined {
  return useLiveQuery(() => readSetupState(), []);
}

/**
 * Back (Android gesture, browser button) calls `onBack` instead of leaving the page, and keeps
 * working when `onBack` only asks a question ("Weiter einrichten"): the entry is re-armed. The
 * history bookkeeping is the shared `core/shell/backStack`.
 */
export function useBackClose(active: boolean, onBack: () => void): void {
  useShellBackClose(active, () => {
    onBack();
    return 'keep';
  });
}
