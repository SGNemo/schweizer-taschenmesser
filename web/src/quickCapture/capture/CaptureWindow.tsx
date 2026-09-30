import { useCallback, useEffect, useRef, useState } from 'react';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { Button } from '@/ui';
import { readPrefs } from '../device';
import type { SavedCapture } from '../targets';
import { CaptureForm } from '../ui/CaptureForm';
import styles from './CaptureWindow.module.css';

/** How long the "saved" confirmation (with undo) stays before the window hides itself. */
export const SAVED_MS = 3000;

/**
 * Content of the small capture window. Each time the shell opens it, the form starts over (and,
 * only if the user switched that on, is pre-filled from the clipboard). After saving, a short
 * confirmation with "Rückgängig" replaces the form.
 */
export function CaptureWindow() {
  const [session, setSession] = useState(0);
  const [prefill, setPrefill] = useState('');
  const [saved, setSaved] = useState<SavedCapture | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const desktop = getPlatform().desktop;

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    void desktop.hideCapture();
  }, [desktop]);

  useEffect(
    () =>
      desktop.onCaptureOpen(() => {
        clearTimeout(timer.current);
        void (async () => {
          const clip = readPrefs().clipboard
            ? await desktop.readClipboard().catch(() => undefined)
            : undefined;
          setPrefill(clip ?? '');
          setSaved(null);
          setSession((s) => s + 1);
        })();
      }),
    [desktop],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  const onSaved = (result: SavedCapture) => {
    setSaved(result);
    timer.current = setTimeout(hide, SAVED_MS);
  };

  const undo = async () => {
    if (!saved) return;
    clearTimeout(timer.current);
    await saved.undo();
    setSaved(null);
    setSession((s) => s + 1);
  };

  return (
    <main
      className={styles.window}
      onKeyDown={(e) => {
        if (e.key === 'Escape') hide();
      }}
    >
      {saved ? (
        <div className={styles.saved} role="status" data-testid="capture-saved">
          <strong>{t.quickCapture.saved(t.quickCapture.target[saved.type])}</strong>
          <div className={styles.actions}>
            <Button onClick={() => void undo()} data-autofocus>
              {t.quickCapture.undo}
            </Button>
            <Button variant="primary" onClick={hide}>
              {t.actions.close}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <CaptureForm
            key={session}
            initialText={prefill}
            selectInitial
            tabSwitchesType
            onSaved={onSaved}
            onCancel={hide}
          />
          <p className={styles.hint}>{t.quickCapture.window.hint}</p>
        </>
      )}
    </main>
  );
}
