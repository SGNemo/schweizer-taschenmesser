import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import {
  flushPurgeQueue,
  listTrash,
  purgeEntry,
  restoreEntry,
  type TrashEntry,
} from '@/core/trash/trash';
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
 * Settings → Allgemein → "Zuletzt gelöscht": what was deleted inside the keep time, with
 * "Wiederherstellen" and "Endgültig löschen" per entry, and the switch that keeps deleted data
 * around for 7, 30 or 90 days. The switch is on by default (30 days); off means only "Rückgängig"
 * right after deleting works. Shortening the time asks first when it would drop entries.
 */
export function RecentlyDeletedSection() {
  const s = tTrash.use();
  const toast = useUiStore((st) => st.toast);
  const [settings, patch] = useTrashSettings();
  const [sure, setSure] = useState<string | undefined>();
  // A shorter time that would drop entries: the new value and the entries it drops, until confirmed.
  const [shorten, setShorten] = useState<{ days: TrashKeepDays; drop: TrashEntry[] } | undefined>();
  // Re-read whenever any table changes (a restore or a new delete elsewhere).
  const entries = useLiveQuery(async () => {
    await flushPurgeQueue();
    return settings.keep ? await listTrash() : [];
  }, [settings.keep, settings.days]);

  async function chooseDays(days: TrashKeepDays) {
    const cutoff = now() - keepWindowMs(days);
    // Read again when the list is not back yet: a quick click must not shorten without the question.
    const drop = (entries ?? (await listTrash())).filter((e) => e.deletedAt <= cutoff);
    if (drop.length > 0) setShorten({ days, drop });
    else void patch({ days });
  }

  /** Confirmed: what drops out is removed for good, so a longer time later cannot bring back a record without its file. */
  async function confirmShorten(next: { days: TrashKeepDays; drop: TrashEntry[] }) {
    setShorten(undefined);
    for (const e of next.drop) await purgeEntry(e).catch(() => false);
    await patch({ days: next.days });
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
            onChange={(days) => void chooseDays(days)}
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
            <Button variant="danger" onClick={() => shorten && void confirmShorten(shorten)}>
              {s.shortenConfirm}
            </Button>
          </>
        }
      >
        {shorten ? <p>{s.shortenBody(shorten.drop.length, Number(shorten.days))}</p> : null}
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
