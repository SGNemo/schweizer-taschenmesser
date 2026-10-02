import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { softBeep } from '@/core/focus/announce';
import { isOver, markAnnounced } from '@/core/focus/session';
import { saveFocusSession, useFocusSession } from '@/core/focus/state';
import { useNow } from '@/core/focus/useNow';
import { useFocusSettings } from '@/core/settings/focus';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';

/**
 * Headless: while a focus round exists, notices once when the time is up (toast with a way back,
 * optional soft tone) – also when the user left the focus screen or reopened the app later.
 */
export function FocusWatcher() {
  const session = useFocusSession();
  const [settings] = useFocusSettings();
  const navigate = useNavigate();
  const toast = useUiStore((s) => s.toast);
  const tick = useNow(1000, Boolean(session));

  useEffect(() => {
    if (!session || session.announced || !isOver(session, tick)) return;
    void saveFocusSession(markAnnounced(session));
    toast(
      t.focus.mode.timeUp,
      session.path
        ? { label: t.focus.mode.back, run: () => void navigate(session.path!) }
        : undefined,
    );
    if (settings.focusSound) softBeep();
  }, [session, tick, settings.focusSound, toast, navigate]);

  return null;
}
