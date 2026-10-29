import { useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { CHORD_LETTERS, createShortcutHandler } from '@/core/keyboard/shortcuts';
import { keyToAction, toolOfAction, type FKeyAction } from '@/core/keyboard/map';
import { currentShortcutPrefs } from '@/core/keyboard/prefs';
import { useTools } from '@/core/tools/state';
import { undoLast } from '@/core/undo';
import { getFocusSession } from '@/core/focus/state';
import { currentVoicePrefs } from '@/core/voice/settings';
import { t } from '@/strings';
import { tKeys } from '@/strings.keys';
import { useUiStore } from '@/stores/ui';
import { useNavTree } from './useNavItems';

/** Mounts the global keyboard shortcuts once (see `core/keyboard/shortcuts.ts` for the table). */
export function useShortcuts(): void {
  const navigate = useNavigate();
  const tree = useNavTree();
  // The latest navigation state, read at key time: the handler itself is created once, so a
  // re-render between "G" and the second key cannot lose the chord.
  const tools = useTools();
  const latest = useRef({ navigate, tree, tools });
  useLayoutEffect(() => {
    latest.current = { navigate, tree, tools };
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
      toolAvailable: (id) => !!latest.current.tools?.active.some((x) => x.id === id),
      openTool: (id) => useUiStore.getState().openTools(id),
      // The voice key keeps its key (set or not, enabled or not): a map entry on it stays silent.
      fkeys: () => {
        const voice = currentVoicePrefs();
        return keyToAction(currentShortcutPrefs(), voice.key);
      },
      runAction: (action) => runFKeyAction(action, latest.current),
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

type Latest = {
  navigate: ReturnType<typeof useNavigate>;
  tools: ReturnType<typeof useTools>;
};

/** What an F-key does. A tool that is off says so in a toast instead of staying silent. */
function runFKeyAction(action: FKeyAction, { navigate, tools }: Latest): void {
  const ui = useUiStore.getState();
  const toolId = toolOfAction(action);
  if (toolId) {
    const tool = tools?.all.find((x) => x.id === toolId);
    if (!tool) return;
    if (tools?.active.includes(tool)) ui.openTools(toolId);
    else ui.toast(tKeys.get().toolOff(tool.name));
    return;
  }
  switch (action) {
    case 'quickAdd':
      return ui.setQuickAddOpen(true);
    case 'palette':
      return ui.setPaletteOpen(true);
    case 'today':
      return void navigate('/');
    case 'settings':
      return void navigate('/settings');
    case 'focus':
      return void startFocus(navigate);
  }
}

/**
 * "Fokus starten": back to a round that is running, else to Heute with the start button focused
 * (one Enter starts it – a key never starts a timer by itself).
 */
async function startFocus(navigate: Latest['navigate']): Promise<void> {
  const running = await getFocusSession();
  if (running?.path) return void navigate(running.path);
  await navigate('/');
  let tries = 0;
  const look = () => {
    const button = document.querySelector<HTMLElement>('[data-focus-start]');
    if (button) button.focus();
    else if (++tries < 15) window.setTimeout(look, 100);
  };
  look();
}
