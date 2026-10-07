import { useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { CHORD_LETTERS, createShortcutHandler } from '@/core/keyboard/shortcuts';
import { undoLast } from '@/core/undo';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { useNavTree } from './useNavItems';

/** Mounts the global keyboard shortcuts once (see `core/keyboard/shortcuts.ts` for the table). */
export function useShortcuts(): void {
  const navigate = useNavigate();
  const tree = useNavTree();
  // The latest navigation state, read at key time: the handler itself is created once, so a
  // re-render between "G" and the second key cannot lose the chord.
  const latest = useRef({ navigate, tree });
  useLayoutEffect(() => {
    latest.current = { navigate, tree };
  });

  useLayoutEffect(() => {
    const handler = createShortcutHandler({
      destination: (letter) => {
        const target = CHORD_LETTERS[letter];
        return target === 'home' ? '/' : latest.current.tree.areas.find((a) => a.id === target)?.to;
      },
      go: (to) => void latest.current.navigate(to),
      quickAdd: () => useUiStore.getState().setQuickAddOpen(true),
      showShortcuts: () => useUiStore.getState().setShortcutsOpen(true),
      undo: () => {
        void undoLast().then((label) =>
          useUiStore.getState().toast(label ? t.ui.undone : t.ui.nothingToUndo),
        );
      },
    });
    // Capture phase: a consumed chord letter must not reach module shortcuts (accounts: P, T).
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  // Alt+L switches the reading aid (Einstellungen → Darstellung → Lesen). Layout-independent via `code`.
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.code !== 'KeyL') return;
      e.preventDefault();
      const ui = useUiStore.getState();
      ui.setReadAid(!ui.readAid);
      ui.toast(ui.readAid ? t.settings.reading.toastOff : t.settings.reading.toastOn);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
