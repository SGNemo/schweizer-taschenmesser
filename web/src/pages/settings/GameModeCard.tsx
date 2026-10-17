import {
  GAME_MODES,
  setGameSettings,
  useGameSettings,
  type GameMode,
} from '@/core/notifications/gameMode';
import { playReminderTone, REMINDER_SOUNDS, type ReminderSound } from '@/core/notifications/sound';
import { getPlatform } from '@/core/platform';
import { tGame } from '@/strings.gamemode';
import { Button, Card, Segmented, SettingRow, TextField } from '@/ui';
import styles from './settings.module.css';

/**
 * Settings → Notifications → "Zock-Modus". On the desktop: automatic detection or manual switch,
 * the app's own tone (three tunes, volume, test). On Android and in the browser there is no tone:
 * the switch only makes reminders arrive on the quiet channel. Device-local (`core/notifications/gameMode`).
 */
export function GameModeCard() {
  const s = tGame.use();
  const settings = useGameSettings();
  const desktop = getPlatform().kind === 'desktop';
  const modes: readonly GameMode[] = desktop ? GAME_MODES : ['off', 'on'];
  const labels = desktop ? s.modes : s.modesQuiet;
  // `auto` stored on a device without detection reads as off.
  const mode = !desktop && settings.mode === 'auto' ? 'off' : settings.mode;
  return (
    <Card>
      <div className={styles.form}>
        <h3>{s.title}</h3>
        <p>{desktop ? s.description : s.descriptionQuiet}</p>
        <SettingRow
          id="game-mode--mode"
          label={s.mode}
          description={desktop ? s.autoHint : undefined}
        >
          <Segmented<GameMode>
            label={s.mode}
            value={mode}
            options={modes.map((m) => ({
              value: m,
              label: labels[m as keyof typeof labels],
            }))}
            onChange={(m) => setGameSettings({ mode: m })}
          />
        </SettingRow>
        {desktop ? (
          <>
            <SettingRow id="game-mode--sound" label={s.sound}>
              <Segmented<ReminderSound>
                label={s.sound}
                value={settings.sound}
                options={REMINDER_SOUNDS.map((v) => ({ value: v, label: s.sounds[v] }))}
                onChange={(sound) => setGameSettings({ sound })}
              />
            </SettingRow>
            <TextField
              label={`${s.volume}: ${s.volumeValue(settings.volume)}`}
              type="range"
              min={0}
              max={100}
              step={5}
              value={settings.volume}
              onChange={(e) => setGameSettings({ volume: Number(e.target.value) })}
            />
            <Button onClick={() => void playReminderTone(settings.sound, settings.volume)}>
              {s.test}
            </Button>
            <p>{s.muteNote}</p>
          </>
        ) : null}
      </div>
    </Card>
  );
}
