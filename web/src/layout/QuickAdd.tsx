import { NavLink, useNavigate } from 'react-router';
import { useAiWriteSettings } from '@/core/ai/write/settings';
import { CaptureForm } from '@/quickCapture/ui/CaptureForm';
import { announceSaved } from '@/quickCapture/ui/announceSaved';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button, Dialog, Icon } from '@/ui';
import { useQuickAddActions } from './useNavItems';
import styles from './SheetList.module.css';

export function QuickAdd() {
  const open = useUiStore((s) => s.quickAddOpen);
  const setOpen = useUiStore((s) => s.setQuickAddOpen);
  const actions = useQuickAddActions();
  const navigate = useNavigate();
  const openWritePalette = useUiStore((s) => s.openWritePalette);
  const [write] = useAiWriteSettings();

  const onSaved: Parameters<typeof CaptureForm>[0]['onSaved'] = (saved) => {
    setOpen(false);
    announceSaved(saved);
  };

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title={t.quickAdd.title} size="roomy">
      {open ? (
        <CaptureForm
          onSaved={onSaved}
          onCancel={() => setOpen(false)}
          onOpenFull={(path) => {
            setOpen(false);
            void navigate(path);
          }}
        />
      ) : null}
      {write?.enabled ? (
        // Free text for any module; on the phone the keyboard's own dictation works in the field.
        <Button
          variant="ghost"
          data-testid="quick-add-ai"
          onClick={() => {
            setOpen(false);
            openWritePalette();
          }}
        >
          <Icon name="sparkles" size={16} /> {t.ai.palette.writeButton}
        </Button>
      ) : null}
      {actions.length === 0 ? (
        <p>{t.quickAdd.empty}</p>
      ) : (
        <details className={styles.others}>
          <summary>{t.quickAdd.others}</summary>
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
        </details>
      )}
    </Dialog>
  );
}
