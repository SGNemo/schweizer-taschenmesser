import { useCallback, useEffect, useState } from 'react';
import { getPlatform } from '@/core/platform';
import type { StartupItem } from '@/core/platform/optimize';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, Card, EmptyState, Skeleton, Switch } from '@/ui';
import { detailOf, enabledCount, groupStartup, withEnabled } from '../logic/startup';
import styles from './StartupTab.module.css';

/**
 * Tab "Autostart": what starts with Windows for this account, with a switch each (the way Task
 * Manager switches: the entry itself stays, so every switch can be taken back, here in the notice
 * and later in the tab "Verlauf"). Entries of the whole PC are shown only; Windows' own settings
 * change those. Nothing is measured or guessed here: how long a program takes is Windows' figure.
 */
export function StartupTab() {
  const optimize = getPlatform().disk.optimize;
  const toast = useUiStore((s) => s.toast);
  const [items, setItems] = useState<StartupItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const x = t.disk.startup;

  const load = useCallback(
    () =>
      optimize
        .startupList()
        .then((list) => {
          setItems(list);
          setFailed(false);
        })
        .catch(() => setFailed(true)),
    [optimize],
  );

  useEffect(() => {
    if (optimize.windows) void load();
  }, [optimize, load]);

  if (!optimize.windows)
    return (
      <div className={styles.tab}>
        <p className={styles.lead}>{x.onlyWindows}</p>
      </div>
    );

  const takeBack = (entryId: number) => {
    optimize
      .undo(entryId)
      .then(() => toast(t.disk.history.undoDone))
      .catch((e: unknown) =>
        toast(
          e instanceof Error && e.message === 'changed-elsewhere'
            ? t.disk.history.changedElsewhere
            : x.undoFailed,
        ),
      )
      .finally(() => void load());
  };

  const set = (item: StartupItem, enabled: boolean) => {
    // One switch at a time. The switches stay enabled meanwhile (a disabled one would lose the
    // keyboard focus); a second press is simply not taken.
    if (busy !== null) return;
    setBusy(item.id);
    optimize
      .setStartup(item.id, enabled)
      .then((entryId) => {
        setItems((list) => (list ? withEnabled(list, item.id, enabled) : list));
        if (entryId !== null)
          toast(enabled ? x.nowOn(item.name) : x.nowOff(item.name), {
            label: x.undo,
            run: () => takeBack(entryId),
          });
      })
      .catch(() => toast(x.setFailed))
      .finally(() => {
        setBusy(null);
        void load();
      });
  };

  const openSettings = () => {
    optimize.openTool('startupApps').catch(() => toast(x.openFailed));
  };

  const groups = items ? groupStartup(items) : null;

  return (
    <div className={styles.tab}>
      {groups?.user.some((i) => i.switchable) ? <p className={styles.lead}>{x.lead}</p> : null}
      {failed ? (
        <>
          <p role="alert">{x.failed}</p>
          <div className={styles.actions}>
            <Button onClick={() => void load()}>{x.again}</Button>
          </div>
        </>
      ) : null}
      {!items && !failed ? (
        <div role="status">
          <span className="sr-only">{x.loading}</span>
          <Skeleton width="60%" height="1.25rem" />
        </div>
      ) : null}
      {items && items.length === 0 ? <EmptyState title={x.empty} /> : null}
      {groups && groups.user.length > 0 ? (
        <section className={styles.group} aria-labelledby="disk-startup-user">
          <div className={styles.head}>
            <h2 id="disk-startup-user" className={styles.title}>
              {x.user}
            </h2>
            <span className={styles.count}>
              {x.count(enabledCount(groups.user), groups.user.length)}
            </span>
          </div>
          <Card as="div">
            <ul className={styles.list} aria-label={x.user} aria-busy={busy !== null}>
              {groups.user.map((item) => (
                <li key={item.id} className={styles.row}>
                  <div className={styles.text}>
                    <span>{item.name}</span>
                    <span className={styles.detail}>{detailOf(item, x.folder)}</span>
                  </div>
                  {item.switchable ? (
                    <Switch
                      label={x.switchLabel(item.name)}
                      labelHidden
                      tone="neutral"
                      checked={item.enabled}
                      onChange={(on) => set(item, on)}
                    />
                  ) : (
                    <span className={styles.state}>
                      {item.enabled ? x.on : x.off} · {x.notSwitchable}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
      {groups && groups.machine.length > 0 ? (
        <section className={styles.group} aria-labelledby="disk-startup-machine">
          <h2 id="disk-startup-machine" className={styles.title}>
            {x.machine}
          </h2>
          <p className={styles.note}>{x.machineHint}</p>
          <Card as="div">
            <ul className={styles.list} aria-label={x.machine}>
              {groups.machine.map((item) => (
                <li key={item.id} className={styles.row}>
                  <div className={styles.text}>
                    <span>{item.name}</span>
                    <span className={styles.detail}>{detailOf(item, x.folder)}</span>
                  </div>
                  <span className={styles.state}>{item.enabled ? x.on : x.off}</span>
                </li>
              ))}
            </ul>
          </Card>
          <div className={styles.actions}>
            <Button onClick={openSettings}>{x.machineOpen}</Button>
          </div>
        </section>
      ) : null}
      {items && items.length > 0 ? <p className={styles.note}>{x.impact}</p> : null}
    </div>
  );
}
