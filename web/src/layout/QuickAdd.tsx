import { NavLink } from 'react-router';
import { CaptureForm } from '@/quickCapture/ui/CaptureForm';
import { announceSaved } from '@/quickCapture/ui/announceSaved';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Dialog, Icon } from '@/ui';
import { useQuickAddActions } from './useNavItems';
import styles from './SheetList.module.css';

export function QuickAdd() {
  const open = useUiStore((s) => s.quickAddOpen);
  const setOpen = useUiStore((s) => s.setQuickAddOpen);
  const actions = useQuickAddActions();

  const onSaved: Parameters<typeof CaptureForm>[0]['onSaved'] = (saved) => {
    setOpen(false);
    announceSaved(saved);
  };

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title={t.quickAdd.title} size="roomy">
      {open ? <CaptureForm onSaved={onSaved} onCancel={() => setOpen(false)} /> : null}
      {actions.length === 0 ? (
        <p>{t.quickAdd.empty}</p>
      ) : (
        <ul className={styles.list}>
          {actions.map((a) => (
            <li key={`${a.icon}-${a.id}`}>
              <NavLink to={a.to} className={styles.link} onClick={() => setOpen(false)}>
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
