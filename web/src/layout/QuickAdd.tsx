import { NavLink } from 'react-router';
import { useModuleStates } from '@/core/modules/activation';
import { visibleManifests } from '@/core/modules/registry';
import { CaptureForm } from '@/quickCapture/ui/CaptureForm';
import { announceSaved } from '@/quickCapture/ui/announceSaved';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Dialog, Icon } from '@/ui';
import styles from './AppShell.module.css';

export function QuickAdd() {
  const open = useUiStore((s) => s.quickAddOpen);
  const setOpen = useUiStore((s) => s.setQuickAddOpen);
  const states = useModuleStates();

  const onSaved: Parameters<typeof CaptureForm>[0]['onSaved'] = (saved) => {
    setOpen(false);
    announceSaved(saved);
  };

  const actions = visibleManifests
    .filter((m) => states?.[m.id])
    .flatMap((m) => (m.contributions?.quickAdd ?? []).map((a) => ({ ...a, icon: m.icon })));

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title={t.quickAdd.title} variant="sheet">
      {open ? <CaptureForm onSaved={onSaved} onCancel={() => setOpen(false)} /> : null}
      {actions.length === 0 ? (
        <p>{t.quickAdd.empty}</p>
      ) : (
        <ul className={styles.navList}>
          {actions.map((a) => (
            <li key={`${a.icon}-${a.id}`}>
              <NavLink to={a.to} className={styles.navLink} onClick={() => setOpen(false)}>
                <Icon name={a.icon} />
                {a.label}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
