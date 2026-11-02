import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useBackClose } from '@/core/shell/useBackClose';
import { availableManifests } from '@/core/modules/available';
import { tCockpit } from '@/strings.cockpit';
import { Icon, IconButton } from '@/ui';
import { COCKPIT_HOME } from './useCockpit';
import styles from './CockpitPanel.module.css';

/** The module whose route is open, for the panel's name. */
function moduleTitle(pathname: string): string | undefined {
  return availableManifests().find(
    (m) => pathname === `/${m.id}` || pathname.startsWith(`/${m.id}/`),
  )?.name;
}

/**
 * Any route other than the overview, shown on top of the cockpit instead of replacing it. The
 * router stays the single source of truth: a widget link, a deep link or quick capture lands here,
 * closing is `navigate('/')`. Esc (useCockpit) and the Android back gesture close it too.
 */
export function CockpitPanel({ open, children }: { open: boolean; children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const ref = useRef<HTMLElement>(null);
  const tx = tCockpit.use();
  const close = () => void navigate(COCKPIT_HOME);
  useBackClose(open, close);
  useEffect(() => {
    if (open) ref.current?.focus({ preventScroll: true });
  }, [open, pathname]);
  if (!open) return null;
  const title = moduleTitle(pathname);
  return (
    <div className={styles.backdrop} data-testid="cockpit-panel">
      <section
        ref={ref}
        tabIndex={-1}
        className={styles.panel}
        aria-label={title ? tx.panel(title) : tx.panelClose}
      >
        <div className={styles.head}>
          <IconButton label={tx.panelClose} onClick={close} data-testid="cockpit-panel-close">
            <Icon name="chevronLeft" />
          </IconButton>
          {title ? <span className={styles.title}>{title}</span> : null}
        </div>
        <div className={styles.body}>{children}</div>
      </section>
    </div>
  );
}
