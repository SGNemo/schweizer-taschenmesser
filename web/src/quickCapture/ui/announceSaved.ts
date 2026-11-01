import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import type { SavedCapture } from '../targets';
import { reopenCapture } from './reopen';

/**
 * Toast "Gespeichert in …" with an undo action; used wherever the main app window saved a capture.
 * Several entries at once: "3 Dinge gespeichert · Ändern" takes all of them back and puts the text
 * into the capture sheet again.
 */
export function announceSaved(saved: SavedCapture): void {
  const { toast } = useUiStore.getState();
  if (saved.count && saved.count > 1) {
    const text = saved.text ?? '';
    toast(t.quickCapture.multi.saved(saved.count), {
      label: t.quickCapture.multi.change,
      run: () => void saved.undo().then(() => reopenCapture(text)),
    });
    return;
  }
  toast(t.quickCapture.saved(t.quickCapture.target[saved.type]), {
    label: t.quickCapture.undo,
    run: () => void saved.undo().then(() => toast(t.quickCapture.undone)),
  });
}
