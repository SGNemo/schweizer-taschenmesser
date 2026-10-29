import { useEffect, useState } from 'react';
import { getPlatform } from '@/core/platform';
import type { NotificationPermissionState } from '@/core/notifications/service';
import { getFocusSettings, patchFocusSettings, useFocusSettings } from '@/core/settings/focus';
import { t } from '@/strings';
import { Button, Checkbox, SelectField, Segmented } from '@/ui';
import styles from '../routes/calendar.module.css';

const QUICK = ['none', '60', '1440'] as const;

/** Lead times offered besides the quick choices, in minutes. */
export const NOTIFY_LEADS = [0, 5, 10, 15, 30, 60, 1440] as const;
export const leadLabel = (m: number): string =>
  m === 0
    ? t.calendar.notify.atStart
    : m === 60
      ? t.calendar.notify.hour
      : m === 1440
        ? t.calendar.notify.day
        : t.calendar.notify.minutes(m);

/**
 * "Erinnern: keine · 1 h · 1 Tag" for an appointment with a time. A choice can be remembered
 * (synced `focus.eventLead`); it only preselects the chip in this editor, nothing is switched on
 * for other appointments. A calm hint appears when the system permission is missing.
 */
export function LeadRow({
  value,
  onChange,
  isNew,
}: {
  value: string;
  onChange: (value: string) => void;
  isNew: boolean;
}) {
  const [focus] = useFocusSettings();
  const [permission, setPermission] = useState<NotificationPermissionState>(() =>
    getPlatform().notifications.permission(),
  );
  const [other, setOther] = useState(false);
  const [touched, setTouched] = useState(false);
  const n = t.calendar.notify;

  useEffect(() => {
    if (!isNew || touched) return;
    let alive = true;
    void getFocusSettings().then((f) => {
      if (alive && f.eventLead !== null) onChange(String(f.eventLead));
    });
    return () => {
      alive = false;
    };
    // Only the first load of the remembered choice; later edits are the user's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quick = (QUICK as readonly string[]).includes(value);
  const showSelect = other || !quick;
  const set = (v: string) => {
    setTouched(true);
    onChange(v);
  };
  const missing = permission === 'default' || permission === 'denied';
  return (
    <div className={styles.leadRow} data-testid="lead-row">
      <Segmented<string>
        label={n.rowLabel}
        value={showSelect ? 'other' : value}
        options={[
          { value: 'none', label: n.noneShort },
          { value: '60', label: n.hourShort },
          { value: '1440', label: n.dayShort },
          { value: 'other', label: n.other },
        ]}
        onChange={(v) => {
          if (v === 'other') {
            setOther(true);
            if (quick) set('15');
          } else {
            setOther(false);
            set(v);
          }
        }}
      />
      {showSelect ? (
        <SelectField label={n.label} value={value} onChange={(e) => set(e.target.value)}>
          {NOTIFY_LEADS.map((m) => (
            <option key={m} value={m}>
              {leadLabel(m)}
            </option>
          ))}
        </SelectField>
      ) : null}
      {value !== 'none' ? (
        <Checkbox
          label={n.remember}
          checked={focus.eventLead === Number(value)}
          onChange={(e) =>
            void patchFocusSettings({ eventLead: e.target.checked ? Number(value) : null })
          }
        />
      ) : null}
      {value !== 'none' && missing && focus.leadHint ? (
        <div className={styles.leadHint} role="note" data-testid="lead-permission-hint">
          <span>{permission === 'denied' ? n.permissionDenied : n.permissionMissing}</span>
          {permission === 'default' ? (
            <Button
              variant="ghost"
              onClick={async () =>
                setPermission(await getPlatform().notifications.requestPermission())
              }
            >
              {n.allow}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => void patchFocusSettings({ leadHint: false })}>
            {n.hintOff}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
