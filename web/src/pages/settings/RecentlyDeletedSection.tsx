import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { flushPurgeQueue, listTrash, purgeEntry, restoreEntry } from '@/core/trash/trash';
import {
  keepWindowMs,
  TRASH_KEEP_DAYS,
  useTrashSettings,
  type TrashKeepDays,
} from '@/core/trash/settings';
import { formatDay, toDateString } from '@/core/time/dates';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { tTrash } from '@/strings.trash';
import {
  Button,
  Dialog,
  ItemList,
  ItemRow,
  Segmented,
  SettingRow,
  SettingsGroup,
  Switch,
} from '@/ui';
import { now } from '@/core/time/now';

/**
 * Settings → Allgemein → "Zuletzt gelöscht": what was deleted in the last 30 days, with
 * "Wiederherstellen" and "Endgültig löschen" per entry, and the switch that keeps deleted data
 * around for 7, 30 or 90 days. The switch is on by default (30 days); off means only "Rückgängig"
 * right after deleting works. Shortening the time asks first when it would drop entries.
 */
export function RecentlyDeletedSection() {
  const s = tTrash.use();
  const toast = useUiStore((st) => st.toast);
  const [settings, patch] = useTrashSettings();
  const [sure, setSure] = useState<string | undefined>();
  // A shorter time that would drop entries: the new value and how many it drops, until confirmed.
  const [shorten, setShorten] = useState<{ days: TrashKeepDays; n: number } | undefined>();
  // Re-read whenever any table changes (a restore or a new delete elsewhere).
  const entries = useLiveQuery(async () => {
    await flushPurgeQueue();
    return settings.keep ? await listTrash() : [];
  }, [settings.keep, settings.days]);

  function chooseDays(days: TrashKeepDays) {
    const cutoff = now() - keepWindowMs(days);
    const dropped = (entries ?? []).filter((e) => e.deletedAt <= cutoff).length;
    if (dropped > 0) setShorten({ days, n: dropped });
    else void patch({ days });
  }
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
      {settings.keep ? (
        <SettingRow id="recently-deleted--days" label={s.days} description={s.daysHint}>
          <Segmented<TrashKeepDays>
            label={s.days}
            value={settings.days}
            options={TRASH_KEEP_DAYS.map((value) => ({ value, label: s.daysOptions[value] }))}
            onChange={chooseDays}
          />
        </SettingRow>
      ) : null}
      <Dialog
        open={shorten !== undefined}
        onClose={() => setShorten(undefined)}
        title={s.shortenTitle}
        footer={
          <>
            <Button onClick={() => setShorten(undefined)}>{t.actions.cancel}</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (shorten) void patch({ days: shorten.days });
                setShorten(undefined);
              }}
            >
              {s.shortenConfirm}
            </Button>
          </>
        }
      >
        {shorten ? <p>{s.shortenBody(shorten.n, Number(shorten.days))}</p> : null}
      </Dialog>
      {!settings.keep ? (
        <p role="status">{s.off}</p>
      ) : entries && entries.length === 0 ? (
        <p role="status" data-testid="trash-empty">
          {s.empty(Number(settings.days))}
        </p>
      ) : (
        <ItemList label={s.list(Number(settings.days))}>
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
