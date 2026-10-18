import { getPlatform } from '@/core/platform';
import type { PlatformKind } from '@/core/platform/types';
import { getGameSettings, isGamingNow, type GameSettings } from './gameMode';
import type { NotificationService } from './service';
import { playReminderTone, type ReminderSound } from './sound';

export interface GameDeliveryDeps {
  kind: PlatformKind;
  settings(): GameSettings;
  /** The desktop shell's yes/no; absent where it cannot tell. */
  detect?(): Promise<boolean>;
  tone(sound: ReminderSound, volume: number): Promise<unknown>;
}

/** Whether a reminder takes the game path right now (see `gameMode.ts`). */
export function gamingNow(deps: Pick<GameDeliveryDeps, 'kind' | 'settings' | 'detect'>) {
  return isGamingNow({ kind: deps.kind, settings: deps.settings(), detect: deps.detect });
}

/**
 * Whether the in-app card should give way to the OS toast: only on the desktop, where a game can
 * cover the window. On Android and in the browser the user is in the app, so the card stays even
 * with the manual switch on (the switch only makes the toast quiet there).
 */
export async function cardGivesWay(
  deps: Pick<GameDeliveryDeps, 'kind' | 'settings' | 'detect'>,
): Promise<boolean> {
  return deps.kind === 'desktop' && (await gamingNow(deps));
}

/**
 * Game mode on top of a platform service. While gaming, a reminder is shown without the system
 * sound (`quiet`) and, on the desktop, followed by the app's own short tone. A reminder that is
 * already quiet ("Stumm") stays silent: no tone, ever. Everything else passes through unchanged,
 * including `scheduleUpcoming` (the Android alarms are built quiet in `collect.ts`).
 */
export function withGameDelivery(
  base: NotificationService,
  deps: GameDeliveryDeps = defaultGameDeps(),
): NotificationService {
  return {
    ...base,
    async show(n) {
      if (n.quiet || !(await gamingNow(deps))) return base.show(n);
      await base.show({ ...n, quiet: true });
      // Where there is no tone (Android, PWA) the quiet channel is the whole effect.
      if (deps.kind === 'desktop') {
        const { sound, volume } = deps.settings();
        await deps.tone(sound, volume);
      }
    },
  };
}

export function defaultGameDeps(): GameDeliveryDeps {
  const platform = getPlatform();
  return {
    kind: platform.kind,
    settings: () => getGameSettings(platform.kind),
    detect: platform.desktop.gameActive?.bind(platform.desktop),
    tone: (sound, volume) => playReminderTone(sound, volume),
  };
}
