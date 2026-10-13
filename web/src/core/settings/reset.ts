/**
 * "Auf Standard zurücksetzen" for a settings section. Only sections that opt in with a `reset`
 * plan have it (look and feel, reading aid, focus aids, calm reminders); nothing security related
 * does (vault, auto-lock, keys, tokens, update channel, disk). Keys and default values are never
 * removed or renamed: a reset writes the defaults that already exist. The confirmation is a toast
 * with "Rückgängig" instead of a dialog.
 */
import { DEFAULT_FOCUS, getFocusSettings, patchFocusSettings, type FocusSettings } from './focus';
import { tComfort } from '@/strings.comfort';
import { t } from '@/strings';
import {
  COLOR_MODES,
  HOME_VIEWS,
  LEADINGS,
  MOTIONS,
  READ_COVERS,
  READ_SHARES,
  READ_STYLES,
  SIDEBARS,
  TEXT_SIZES,
  DENSITIES,
  useUiStore,
} from '@/stores/ui';

export interface ResetPlan {
  /** Current values, in a form `restore` accepts. */
  capture(): Promise<unknown>;
  toDefaults(): Promise<void>;
  restore(snapshot: unknown): Promise<void>;
}

const ui = () => useUiStore.getState();

/** Look and feel: everything the "Darstellung" section shows except supporter palettes and logo. */
const APPEARANCE_KEYS = [
  'theme',
  'accent',
  'textSize',
  'leading',
  'density',
  'sidebar',
  'motion',
  'colorMode',
  'homeView',
] as const;

const APPEARANCE_DEFAULTS = {
  theme: 'system',
  accent: 'orange',
  textSize: TEXT_SIZES[0],
  leading: LEADINGS[0],
  density: DENSITIES[0],
  sidebar: SIDEBARS[0],
  motion: MOTIONS[0],
  colorMode: COLOR_MODES[0],
  homeView: HOME_VIEWS[0],
} as const;

type Choices = Record<(typeof APPEARANCE_KEYS)[number], string>;

function writeAppearance(values: Choices): void {
  const s = ui();
  s.setTheme(values.theme as never);
  s.setAccent(values.accent as never);
  s.setTextSize(values.textSize as never);
  s.setLeading(values.leading as never);
  s.setDensity(values.density as never);
  s.setSidebar(values.sidebar as never);
  s.setMotion(values.motion as never);
  s.setColorMode(values.colorMode as never);
  s.setHomeView(values.homeView as never);
}

export const appearanceReset: ResetPlan = {
  capture: () => {
    const s = ui() as unknown as Choices;
    return Promise.resolve(Object.fromEntries(APPEARANCE_KEYS.map((k) => [k, s[k]])));
  },
  toDefaults: () => Promise.resolve(writeAppearance({ ...APPEARANCE_DEFAULTS })),
  restore: (snap) => Promise.resolve(writeAppearance(snap as Choices)),
};

export const readingReset: ResetPlan = {
  capture: () => {
    const s = ui();
    return Promise.resolve({
      aid: s.readAid,
      share: s.readShare,
      style: s.readStyle,
      cover: s.readCover,
    });
  },
  toDefaults: () => {
    const s = ui();
    s.setReadAid(false);
    s.setReadShare(READ_SHARES[0]);
    s.setReadStyle(READ_STYLES[0]);
    s.setReadCover(READ_COVERS[0]);
    return Promise.resolve();
  },
  restore: (snap) => {
    const v = snap as { aid: boolean; share: never; style: never; cover: never };
    const s = ui();
    s.setReadAid(v.aid);
    s.setReadShare(v.share);
    s.setReadStyle(v.style);
    s.setReadCover(v.cover);
    return Promise.resolve();
  },
};

/** A reset of some keys of the synced focus settings (scope `focus`). */
export function focusReset(keys: readonly (keyof FocusSettings)[]): ResetPlan {
  const pick = (from: FocusSettings) => Object.fromEntries(keys.map((k) => [k, from[k]]));
  return {
    capture: async () => pick(await getFocusSettings()),
    toDefaults: () => patchFocusSettings(pick(DEFAULT_FOCUS) as Partial<FocusSettings>),
    restore: (snap) => patchFocusSettings(snap as Partial<FocusSettings>),
  };
}

export const FOCUS_RESET_KEYS = [
  'nextOne',
  'dayPlan',
  'planLimit',
  'calmAttention',
  'moduleNow',
  'timeToNext',
  'focusMinutes',
  'focusSound',
  'focusIndicator',
  'resumeCard',
  'streaks',
  'weekReview',
  'eveningWrapUp',
  'searchHistory',
] as const satisfies readonly (keyof FocusSettings)[];

export const REMINDER_RESET_KEYS = [
  'inAppPrompt',
  'inAppPosition',
  'inAppSeconds',
  'quietHours',
  'quietFrom',
  'quietTo',
  'maxPerHour',
  'staggered',
  'stages',
  'followUp',
  'todoDigest',
  'todoDigestTime',
] as const satisfies readonly (keyof FocusSettings)[];

/** Puts a section back to its defaults and offers "Rückgängig" in the confirmation toast. */
export async function resetSection(plan: ResetPlan, title: string): Promise<void> {
  const before = await plan.capture();
  await plan.toDefaults();
  ui().toast(tComfort.get().reset.done(title), {
    label: t.ui.undo,
    run: () => void plan.restore(before),
  });
}
