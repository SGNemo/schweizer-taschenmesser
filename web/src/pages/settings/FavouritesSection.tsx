import { setFavourite } from '@/core/settings/nav';
import { useNavTree } from '@/layout/useNavItems';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { SettingRow, SettingsGroup, Switch } from '@/ui';

/** Favourites (max. 5): the same choice as the star in the sidebar, reachable on touch devices. */
export function FavouritesSection() {
  const tree = useNavTree();
  const toast = useUiStore((s) => s.toast);
  const shown = tree.favourites.flatMap((i) => (i.moduleId ? [i.moduleId] : []));
  const items = tree.areas.flatMap((a) => a.items).filter((i) => i.moduleId);
  return (
    <SettingsGroup
      id="favourites"
      title={t.settings.favourites}
      description={t.settings.favouritesHint}
    >
      {items.map((i) => (
        <SettingRow key={i.to} id={`favourites--${i.moduleId}`} label={i.label}>
          <Switch
            label={i.label}
            labelHidden
            checked={shown.includes(i.moduleId!)}
            onChange={() => {
              void setFavourite(i.moduleId!, shown).then((changed) => {
                if (!changed) toast(t.settings.favouritesFull);
              });
            }}
          />
        </SettingRow>
      ))}
    </SettingsGroup>
  );
}
