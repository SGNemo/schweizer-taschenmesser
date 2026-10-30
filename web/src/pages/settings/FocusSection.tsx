import {
  FOCUS_MINUTES,
  PLAN_LIMITS,
  useFocusSettings,
  type FocusSettings,
} from '@/core/settings/focus';
import { clearRecent } from '@/core/search/recent';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, Segmented, SettingRow, SettingsGroup, Switch } from '@/ui';
import { FocusMusicRow } from './FocusMusicRow';
import { FoldedGroup } from './FoldedGroup';

type BoolKey = {
  [K in keyof FocusSettings]: FocusSettings[K] extends boolean ? K : never;
}[keyof FocusSettings];

/** The six aids of the first group and the six extra switches of "Weitere Einstellungen". */
const AIDS: readonly BoolKey[] = [
  'nextOne',
  'dayPlan',
  'calmAttention',
  'timeToNext',
  'resumeCard',
  'eveningWrapUp',
];
const EXTRAS: readonly BoolKey[] = [
  'moduleNow',
  'focusSound',
  'focusIndicator',
  'streaks',
  'weekReview',
  'searchHistory',
];

/**
 * Settings → Darstellung → "Fokus & Aufmerksamkeit": one switch per aid (synced scope `focus`),
 * as two folded lines ("Hilfen: 6 von 6 an · Ändern", "Weitere Einstellungen: …").
 */
export function FocusSection() {
  const [values, patch] = useFocusSettings();
  const s = t.focus.settings;
  const toast = useUiStore((x) => x.toast);
  const on = (keys: readonly BoolKey[]) => keys.filter((k) => values[k]).length;
  const toggle = (key: BoolKey, label: string, hint: string) => (
    <SettingRow id={`focus--${key}`} label={label} description={hint} key={key}>
      <Switch
        label={label}
        labelHidden
        checked={values[key]}
        onChange={(v) => {
          // Switching the history off also forgets what it kept.
          if (key === 'searchHistory' && !v) clearRecent();
          void patch({ [key]: v });
        }}
      />
    </SettingRow>
  );
  return (
    <SettingsGroup id="focus" title={s.title} description={s.description}>
      <FoldedGroup
        section="focus"
        id="aids"
        title={s.aids}
        current={[s.aidsOn(on(AIDS), AIDS.length)]}
      >
        {toggle('nextOne', s.nextOne, s.nextOneHint)}
        {toggle('dayPlan', s.dayPlan, s.dayPlanHint)}
        {toggle('calmAttention', s.calmAttention, s.calmAttentionHint)}
        {toggle('timeToNext', s.timeToNext, s.timeToNextHint)}
        {toggle('resumeCard', s.resumeCard, s.resumeCardHint)}
        {toggle('eveningWrapUp', s.eveningWrapUp, s.eveningWrapUpHint)}
      </FoldedGroup>
      <FoldedGroup
        section="focus"
        id="more"
        testId="focus-more"
        title={s.more}
        current={[
          s.planShort(values.planLimit),
          s.timerShort(values.focusMinutes),
          s.aidsOn(on(EXTRAS), EXTRAS.length),
        ]}
      >
        <SettingRow id="focus--planLimit" label={s.planLimit} description={s.planLimitHint}>
          <Segmented<string>
            label={s.planLimit}
            value={String(values.planLimit)}
            options={PLAN_LIMITS.map((n) => ({ value: String(n), label: String(n) }))}
            onChange={(v) => void patch({ planLimit: Number(v) })}
          />
        </SettingRow>
        <SettingRow
          id="focus--focusMinutes"
          label={s.focusMinutes}
          description={s.focusMinutesHint}
        >
          <Segmented<string>
            label={s.focusMinutes}
            value={String(values.focusMinutes)}
            options={FOCUS_MINUTES.map((n) => ({
              value: String(n),
              label: s.focusMinutesOption(n),
            }))}
            onChange={(v) => void patch({ focusMinutes: Number(v) })}
          />
        </SettingRow>
        {toggle('moduleNow', s.moduleNow, s.moduleNowHint)}
        {toggle('focusSound', s.focusSound, s.focusSoundHint)}
        {toggle('focusIndicator', s.focusIndicator, s.focusIndicatorHint)}
        {toggle('streaks', s.streaks, s.streaksHint)}
        {toggle('weekReview', s.weekReview, s.weekReviewHint)}
        {toggle('searchHistory', s.searchHistory, s.searchHistoryHint)}
        <SettingRow
          id="focus--clearHistory"
          label={s.clearHistory}
          description={s.clearHistoryHint}
        >
          <Button
            onClick={() => {
              clearRecent();
              toast(s.historyCleared);
            }}
          >
            {s.clearHistory}
          </Button>
        </SettingRow>
        <FocusMusicRow />
      </FoldedGroup>
    </SettingsGroup>
  );
}
