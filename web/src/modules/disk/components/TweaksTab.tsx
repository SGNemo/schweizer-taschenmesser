import { useEffect, useState } from 'react';
import { getPlatform } from '@/core/platform';
import type { TweakState } from '@/core/platform/optimize';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, Card, Dialog, EmptyState, SelectField, Skeleton, Switch } from '@/ui';
import {
  changedHere,
  choiceLabel,
  groupTweaks,
  isMicrosoftSource,
  joinNames,
  switchState,
} from '../logic/tweaks';
import styles from './TweaksTab.module.css';

/** The title of a setting (read at render time); an id without a text shows as itself. */
export const tweakTitle = (id: string): string => t.disk.tweaks.title[id] ?? id;

/**
 * Tab "Einstellungen": a small catalogue of settings Windows offers itself, each with what it
 * does, its risk and the Microsoft page that documents it. A change is made natively only after
 * the state from before is stored, shows up in "Verlauf" with "Rückgängig", and "Alle
 * zurücksetzen" puts everything changed here back. Nothing is switched without a click.
 */
export function TweaksTab() {
  const optimize = getPlatform().disk.optimize;
  const toast = useUiStore((s) => s.toast);
  const [list, setList] = useState<TweakState[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const x = t.disk.tweaks;

  useEffect(() => {
    if (!optimize.windows) return;
    let alive = true;
    optimize
      .tweaks()
      .then((r) => {
        if (!alive) return;
        setList(r);
        setFailed(false);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [optimize, reload]);

  if (!optimize.windows) {
    return (
      <div className={styles.tab}>
        <EmptyState title={x.onlyWindows}>
          <p>{x.onlyWindowsHint}</p>
        </EmptyState>
      </div>
    );
  }

  const change = (tweak: TweakState, target: boolean | string) => {
    if (busy) return;
    setBusy(true);
    const title = tweakTitle(tweak.id);
    optimize
      .setTweak(tweak.id, target)
      .then(() =>
        toast(
          typeof target === 'boolean'
            ? x.switched(title, target)
            : x.chosen(title, tweak.options.find((o) => o.id === target)?.label ?? ''),
        ),
      )
      .catch(() => toast(x.setFailed))
      .finally(() => {
        setBusy(false);
        setReload((n) => n + 1);
      });
  };

  const resetAll = () => {
    setConfirming(false);
    setBusy(true);
    optimize
      .resetTweaks()
      .then((r) => {
        if (r.restored.length > 0) toast(x.resetDone(joinNames(r.restored.map(tweakTitle))));
        if (r.left.length > 0) toast(x.resetLeft(joinNames(r.left.map(tweakTitle))));
        if (r.failed.length > 0) toast(x.resetPartial(joinNames(r.failed.map(tweakTitle))));
      })
      .catch(() => toast(x.setFailed))
      .finally(() => {
        setBusy(false);
        setReload((n) => n + 1);
      });
  };

  const openRestorePoint = () => {
    optimize.openTool('systemProtection').catch(() => toast(t.disk.tidy.windows.openFailed));
  };

  const groups = list ? groupTweaks(list) : [];
  const changed = list ? changedHere(list) : [];

  return (
    <div className={styles.tab}>
      <p className={styles.lead}>{x.lead}</p>
      <div className={styles.bar}>
        <p className={styles.status} role="status">
          {list ? x.changedCount(changed.length) : ''}
        </p>
        <div className={styles.actions}>
          <Button onClick={openRestorePoint}>{x.restorePoint}</Button>
          <Button disabled={busy || changed.length === 0} onClick={() => setConfirming(true)}>
            {x.resetAll}
          </Button>
        </div>
      </div>
      <p className={styles.muted}>{x.restorePointHint}</p>
      {failed ? <p role="alert">{x.failed}</p> : null}
      {!list && !failed ? (
        <div role="status" aria-label={x.loading}>
          <Skeleton width="60%" height="1.25rem" />
        </div>
      ) : null}
      {list && groups.length === 0 ? <EmptyState title={x.none} /> : null}
      {groups.map((g) => (
        <section key={g.group} className={styles.group} aria-label={x.group[g.group]}>
          <h2>{x.group[g.group]}</h2>
          <Card as="div">
            <ul className={styles.list}>
              {g.items.map((tweak) => (
                <li key={tweak.id} className={styles.row} data-testid={`tweak-${tweak.id}`}>
                  <Row tweak={tweak} busy={busy} onChange={(target) => change(tweak, target)} />
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ))}
      {confirming ? (
        <Dialog
          open
          onClose={() => setConfirming(false)}
          title={x.resetTitle}
          footer={
            <>
              <Button onClick={() => setConfirming(false)} data-autofocus>
                {x.cancel}
              </Button>
              <Button variant="primary" onClick={resetAll}>
                {x.resetConfirm}
              </Button>
            </>
          }
        >
          <p className={styles.dialogText}>{x.resetText}</p>
          <ul className={styles.dialogList}>
            {changed.map((c) => (
              <li key={c.id}>{tweakTitle(c.id)}</li>
            ))}
          </ul>
        </Dialog>
      ) : null}
    </div>
  );
}

/** One setting: what it is, its control, and the folded details with risk and source. */
function Row({
  tweak,
  busy,
  onChange,
}: {
  tweak: TweakState;
  busy: boolean;
  onChange: (target: boolean | string) => void;
}) {
  const x = t.disk.tweaks;
  const title = tweakTitle(tweak.id);
  const state = switchState(tweak);
  const riskNote = x.riskNote[tweak.id];
  const openSource = () => {
    if (isMicrosoftSource(tweak.sourceUrl)) void getPlatform().app.openUrl(tweak.sourceUrl);
  };
  return (
    <>
      <div className={styles.head}>
        <div className={styles.text}>
          <h3 className={styles.name}>{title}</h3>
          <p className={styles.what}>{x.what[tweak.id]}</p>
          {tweak.changedHere ? <p className={styles.changed}>{x.changedHere}</p> : null}
        </div>
        <div className={styles.control}>
          {!tweak.readable ? null : tweak.kind === 'choice' ? (
            <SelectField
              label={x.chooseLabel(title)}
              labelHidden
              value={tweak.choice ?? ''}
              disabled={busy}
              onChange={(e) => onChange(e.currentTarget.value)}
            >
              {tweak.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </SelectField>
          ) : state === 'default' ? (
            // Windows' own default applies and is not documented: no switch pretends to know it.
            <div className={styles.pair}>
              <Button
                size="sm"
                disabled={busy}
                aria-label={x.turnOnLabel(title)}
                onClick={() => onChange(true)}
              >
                {x.turnOn}
              </Button>
              <Button
                size="sm"
                disabled={busy}
                aria-label={x.turnOffLabel(title)}
                onClick={() => onChange(false)}
              >
                {x.turnOff}
              </Button>
            </div>
          ) : (
            <Switch
              label={title}
              labelHidden
              tone="neutral"
              checked={state === 'on'}
              disabled={busy}
              onChange={onChange}
            />
          )}
        </div>
      </div>
      {!tweak.readable ? (
        <p className={styles.state}>{x.unreadable}</p>
      ) : tweak.kind === 'toggle' ? (
        <p className={styles.state}>
          {state === 'default' ? x.windowsDefault : state === 'on' ? x.stateOn : x.stateOff}
        </p>
      ) : (
        <p className={styles.state}>{x.stateChoice(choiceLabel(tweak))}</p>
      )}
      <details className={styles.more}>
        <summary aria-label={x.moreLabel(title)}>{x.more}</summary>
        <div className={styles.moreBody}>
          <p>{x.detail[tweak.id]}</p>
          <p>
            {x.risk[tweak.risk]}
            {riskNote ? ` ${riskNote}` : ''}
          </p>
          {tweak.refresh === 'explorer' ? <p>{x.refresh.explorer}</p> : null}
          {isMicrosoftSource(tweak.sourceUrl) ? (
            <p>
              <a
                href={tweak.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={x.sourceLabel(title)}
                onClick={(e) => {
                  e.preventDefault();
                  openSource();
                }}
              >
                {x.source}
              </a>
            </p>
          ) : null}
        </div>
      </details>
    </>
  );
}
