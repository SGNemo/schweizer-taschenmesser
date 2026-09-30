import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import type { SavedCapture } from '../targets';

/** Toast "Gespeichert in …" with an undo action; used wherever the main app window saved a capture. */
export function announceSaved(saved: SavedCapture): void {
  const { toast } = useUiStore.getState();
  toast(t.quickCapture.saved(t.quickCapture.target[saved.type]), {
    label: t.quickCapture.undo,
    run: () => void saved.undo().then(() => toast(t.quickCapture.undone)),
  });
}
