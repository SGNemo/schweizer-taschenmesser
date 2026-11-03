import { useEffect, useState } from 'react';
import { useFocusSettings } from '@/core/settings/focus';
import { activeProfile, lastAppliedProfileId, type Profile } from '@/core/settings/profiles';
import { ALL_VALUE_KEYS, readValues } from '@/core/settings/values';
import { useUiStore } from '@/stores/ui';

/** The id of the profile whose values are all set right now, if any (re-checked when the look or the focus settings change). */
export function useActiveProfileId(profiles: readonly Profile[]): string | undefined {
  const ui = useUiStore((s) => s);
  const [focus] = useFocusSettings();
  const [active, setActive] = useState<string>();
  useEffect(() => {
    let live = true;
    void readValues(ALL_VALUE_KEYS).then((cur) => {
      if (live) setActive(activeProfile(profiles, cur, lastAppliedProfileId())?.id);
    });
    return () => {
      live = false;
    };
  }, [profiles, ui, focus]);
  return active;
}
