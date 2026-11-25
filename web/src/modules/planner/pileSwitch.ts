/**
 * The pile switches (planner hub 2, package 2; COPY P5, P6, P11, P13): `pileMoney` / `pileMail` are synced planner
 * settings, flat per area (settings merge per top-level key). The undo journal does not hold settings, so the offer's
 * toast P6 carries an explicit inverse: „Rückgängig“ sets the switch back to what it was. „Nicht mehr anbieten“ (P13)
 * is a device-local flag, no toast.
 */
import { getSettings, setSettings } from '@/core/settings/settings';
import type { PileArea } from '@/core/modules/types';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import {
  DEFAULT_PLANNER_SETTINGS,
  PLANNER_SCOPE,
  plannerSettingsSchema,
  type PlannerSettings,
} from './settings';

const KEY: Record<PileArea, 'pileMoney' | 'pileMail'> = { money: 'pileMoney', mail: 'pileMail' };
const DISMISS_KEY = (area: PileArea) => `tm-pile-offer-${area}`;

/** Sets the area's switch; returns what it was (undefined = never asked). */
export async function setPileSwitch(
  area: PileArea,
  on: boolean | undefined,
): Promise<boolean | undefined> {
  const before = (
    (await getSettings(
      PLANNER_SCOPE,
      plannerSettingsSchema,
      DEFAULT_PLANNER_SETTINGS,
    )) as PlannerSettings
  )[KEY[area]];
  await setSettings(PLANNER_SCOPE, { [KEY[area]]: on }, DEFAULT_PLANNER_SETTINGS);
  return before;
}

/** The offer's tap (P5): the switch on, toast P6 whose „Rückgängig“ sets it back. */
export async function acceptPileOffer(area: PileArea): Promise<void> {
  const before = await setPileSwitch(area, true);
  useUiStore.getState().toast(t.planner.pile.toast(t.planner.pile.area[area]), {
    label: t.ui.undo,
    run: () => void setPileSwitch(area, before),
  });
}

/** „Nicht mehr anbieten“ (P13): this device never shows the offer of that area again. */
export function dismissPileOffer(area: PileArea): void {
  try {
    localStorage.setItem(DISMISS_KEY(area), '1');
  } catch {
    // Storage blocked: the offer may come back; nothing else depends on it.
  }
}

export function pileOfferDismissed(area: PileArea): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY(area)) === '1';
  } catch {
    return false;
  }
}
