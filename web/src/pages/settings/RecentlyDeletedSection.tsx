import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { flushPurgeQueue, listTrash, purgeEntry, restoreEntry } from '@/core/trash/trash';
import { useTrashSettings } from '@/core/trash/settings';
import { formatDay, toDateString } from '@/core/time/dates';
import { useUiStore } from '@/stores/ui';
import { tTrash } from '@/strings.trash';
import { Button, ItemList, ItemRow, SettingRow, SettingsGroup, Switch } from '@/ui';

/**
 * Settings → Allgemein → "Zuletzt gelöscht": what was deleted in the last 30 days, with
 * "Wiederherstellen" and "Endgültig löschen" per entry, and the switch that keeps deleted data
 * around. The switch is on by default; off means only "Rückgängig" right after deleting works.
 */
export function RecentlyDeletedSection() {
  const s = tTrash.use();
  const toast = useUiStore((st) => st.toast);
  const [settings, patch] = useTrashSettings();
  const [sure, setSure] = useState<string | undefined>();
  // Re-read whenever any table changes (a restore or a new delete elsewhere).
  const entries = useLiveQuery(async () => {
    await flushPurgeQueue();
    return settings.keep ? await listTrash() : [];
  }, [settings.keep]);
  return (
    <SettingsGroup id="recently-deleted" title={s.title} description={s.description}>
      <SettingRow id="recently-deleted--keep" label={s.keep} description={s.keepHint}>
        <Switch
          label={s.keep}
          labelHidden
          checked={settings.keep}
          onChange={(keep) => void patch({ keep })}
        />
      </SettingRow>
      {!settings.keep ? (
        <p role="status">{s.off}</p>
      ) : entries && entries.length === 0 ? (
        <p role="status" data-testid="trash-empty">
          {s.empty}
        </p>
      ) : (
        <ItemList label={s.list}>
          {entries?.map((e) => {
            const k = `${e.table}|${e.id}`;
            return (
              <ItemRow
                key={k}
                title={e.title}
                meta={s.meta(
                  s.kinds[e.kind],
                  formatDay(toDateString(new Date(e.deletedAt)), 'd. MMM yyyy'),
                  e.daysLeft,
                )}
                end={
                  <>
                    <Button
                      size="sm"
                      aria-label={s.restoreAria(e.title)}
                      onClick={async () => {
                        await restoreEntry(e);
                        toast(s.restored);
                      }}
                    >
                      {s.restore}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      aria-label={s.purgeAria(e.title)}
                      onClick={async () => {
                        if (sure !== k) return setSure(k);
                        setSure(undefined);
                        toast((await purgeEntry(e)) ? s.purged : s.purgeWaits);
                      }}
                    >
                      {sure === k ? s.purgeSure : s.purge}
                    </Button>
                  </>
                }
              />
            );
          })}
        </ItemList>
      )}
    </SettingsGroup>
  );
}
