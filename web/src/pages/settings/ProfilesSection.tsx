import { useState } from 'react';
import { dateTimeFormat } from '@/core/i18n/format';
import {
  applyProfile,
  builtinProfiles,
  deleteProfile,
  isBuiltinProfile,
  newSchedule,
  readSchedules,
  restoreProfile,
  saveCurrentAsProfile,
  useCustomProfiles,
  writeSchedules,
  type Profile,
  type Schedule,
} from '@/core/settings/profiles';
import { TIME_RE } from '@/core/time/dates';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { tSettings3 } from '@/strings.settings3';
import {
  Badge,
  Button,
  Chip,
  Chips,
  Icon,
  IconButton,
  SelectField,
  SettingRow,
  SettingsGroup,
  TextField,
} from '@/ui';
import settingsStyles from './settings.module.css';
import styles from './ProfilesSection.module.css';
import { useActiveProfileId } from './useActiveProfile';

/** Short weekday name of `day` (0 = Sunday) in the current language and format. */
const dayName = (day: number) =>
  dateTimeFormat({ weekday: 'short' }).format(new Date(2026, 10, 1 + day));

function ScheduleRow({
  schedule,
  profiles,
  onChange,
  onRemove,
}: {
  schedule: Schedule;
  profiles: readonly Profile[];
  onChange: (next: Schedule) => void;
  onRemove: () => void;
}) {
  const p = tSettings3.use().profiles;
  return (
    <div className={styles.schedule} data-testid="schedule-row">
      <SelectField
        label={p.scheduleProfile}
        value={schedule.profileId}
        onChange={(e) => onChange({ ...schedule, profileId: e.target.value })}
      >
        {profiles.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </SelectField>
      <TextField
        label={p.scheduleTime}
        type="time"
        value={schedule.time}
        onChange={(e) =>
          TIME_RE.test(e.target.value) && onChange({ ...schedule, time: e.target.value })
        }
      />
      <Chips label={p.scheduleDays}>
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <Chip
            key={d}
            label={dayName(d)}
            selected={schedule.days.includes(d)}
            onClick={() => {
              const days = schedule.days.includes(d)
                ? schedule.days.filter((x) => x !== d)
                : [...schedule.days, d];
              // A schedule without a day would never run: keep at least one.
              if (days.length > 0) onChange({ ...schedule, days });
            }}
          />
        ))}
      </Chips>
      <IconButton label={p.scheduleRemove} onClick={onRemove}>
        <Icon name="trash" />
      </IconButton>
    </div>
  );
}

function Schedules({ profiles }: { profiles: readonly Profile[] }) {
  const p = tSettings3.use().profiles;
  const [items, setItems] = useState<Schedule[]>(() => readSchedules());
  const save = (next: Schedule[]) => {
    setItems(next);
    writeSchedules(next);
  };
  return (
    <SettingRow
      id="profiles--schedules"
      label={p.scheduleTitle}
      description={p.scheduleHint}
      stacked
    >
      <div className={styles.scheduleList}>
        {items.length === 0 ? <p className={settingsStyles.muted}>{p.scheduleEmpty}</p> : null}
        {items.map((s) => (
          <ScheduleRow
            key={s.id}
            schedule={s}
            profiles={profiles}
            onChange={(next) => save(items.map((x) => (x.id === s.id ? next : x)))}
            onRemove={() => save(items.filter((x) => x.id !== s.id))}
          />
        ))}
        <div>
          <Button onClick={() => save([...items, newSchedule(profiles[0]!.id)])}>
            {p.scheduleAdd}
          </Button>
        </div>
      </div>
    </SettingRow>
  );
}

/** Settings → Allgemein → Verwalten → "Profile": switch many settings at once, save your own, schedule them. */
export function ProfilesSection() {
  const p = tSettings3.use().profiles;
  const toast = useUiStore((s) => s.toast);
  const custom = useCustomProfiles();
  const all = [...builtinProfiles(), ...custom];
  const active = useActiveProfileId(all);
  const [name, setName] = useState('');
  const hints = p.builtinHint as Record<string, string>;
  return (
    <SettingsGroup id="profiles" title={p.title} description={p.description}>
      {all.map((x) => (
        <SettingRow
          key={x.id}
          id={`profiles--${x.id}`}
          label={x.name}
          description={isBuiltinProfile(x.id) ? hints[x.id] : undefined}
        >
          <span className={settingsStyles.row}>
            {active === x.id ? (
              <Badge>{p.active}</Badge>
            ) : (
              <Button onClick={() => void applyProfile(x)} data-testid={`profile-apply-${x.id}`}>
                {p.apply}
              </Button>
            )}
            {isBuiltinProfile(x.id) ? null : (
              <IconButton
                label={p.remove(x.name)}
                onClick={() =>
                  void deleteProfile(x.id).then((gone) => {
                    if (gone)
                      toast(p.removed(gone.name), {
                        label: t.ui.undo,
                        run: () => void restoreProfile(gone),
                      });
                  })
                }
              >
                <Icon name="trash" />
              </IconButton>
            )}
          </span>
        </SettingRow>
      ))}
      <SettingRow id="profiles--save" label={p.saveTitle} description={p.contains} stacked>
        <form
          className={settingsStyles.row}
          onSubmit={(e) => {
            e.preventDefault();
            void saveCurrentAsProfile(name).then((saved) => {
              if (saved) {
                setName('');
                toast(p.saved(saved.name));
              }
            });
          }}
        >
          <TextField
            label={p.nameLabel}
            labelHidden
            placeholder={p.nameLabel}
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" disabled={name.trim() === ''}>
            {p.save}
          </Button>
        </form>
      </SettingRow>
      <Schedules profiles={all} />
    </SettingsGroup>
  );
}
