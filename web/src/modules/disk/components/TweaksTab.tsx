import { useEffect, useRef, useState } from 'react';
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
  resetMessage,
  switchState,
} from '../logic/tweaks';
import styles from './TweaksTab.module.css';

/** The title of a setting (read at render time); an id without a text shows as itself. */
export const tweakTitle = (id: string): string => t.disk.tweaks.title[id] ?? id;

/** Focus wish for the top of the tab (no setting has this id). */
const TOP = ':top';

/**
 * Tab "Windows-Einstellungen": a small catalogue of settings Windows offers itself, each with
 * what it does, where Windows shows it and the Microsoft page that documents it. A change is made
 * natively only after the state from before is stored, can be taken back in the notice and later
 * in "Verlauf", and "Alle zurücksetzen" puts everything changed here back. Nothing is switched
 * without a click.
 */
export function TweaksTab() {
  const optimize = getPlatform().disk.optimize;
  const toast = useUiStore((s) => s.toast);
  const [list, setList] = useState<TweakState[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const lead = useRef<HTMLParagraphElement>(null);
  const resetWrap = useRef<HTMLDivElement>(null);
  const focusWish = useRef<string | null>(null);
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

  // A change can replace the very control that had the focus (two buttons become a switch, the
  // reset button leaves with the last change). The focus then goes to what stands in its place,
  // never to the page body; a focus the user moved elsewhere is left alone.
  useEffect(() => {
    const wish = focusWish.current;
    if (wish === null || !list) return;
    focusWish.current = null;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const target =
      wish === TOP
        ? (resetWrap.current?.querySelector<HTMLElement>('button') ?? lead.current)
        : rows.current
            .get(wish)
            ?.querySelector<HTMLElement>('[data-control] :is([role="switch"], select, button)');
    target?.focus();
  }, [list]);

  if (!optimize.windows) {
    return (
      <div className={styles.tab}>
        <EmptyState title={x.onlyWindows}>
          <p>{x.onlyWindowsHint}</p>
        </EmptyState>
      </div>
    );
  }

  /** Reads the list again; the focus follows to `wish` if its control is gone by then. */
  const readAgain = (wish: string | null) => {
    focusWish.current = wish;
    setReload((n) => n + 1);
  };

  const takeBack = (tweakId: string, entryId: number) => {
    optimize
      .undo(entryId)
      .then(() => toast(t.disk.history.undoDone))
      .catch((e: unknown) =>
        toast(
          e instanceof Error && e.message === 'changed-elsewhere'
            ? t.disk.history.changedElsewhere
            : t.disk.history.undoFailed,
        ),
      )
      .finally(() => readAgain(tweakId));
  };

  const change = (tweak: TweakState, target: boolean | string) => {
    // One change at a time. The controls stay enabled meanwhile (a disabled one would lose the
    // keyboard focus); a second press is simply not taken.
    if (busy) return;
    setBusy(true);
    const title = tweakTitle(tweak.id);
    optimize
      .setTweak(tweak.id, target)
      .then((entryId) => {
        if (entryId === null) return;
        toast(
          typeof target === 'boolean'
            ? x.switched(title, target)
            : x.chosen(title, tweak.options.find((o) => o.id === target)?.label ?? ''),
          { label: t.disk.history.undo, run: () => takeBack(tweak.id, entryId) },
        );
      })
      .catch(() => toast(x.setFailed))
      .finally(() => {
        setBusy(false);
        readAgain(tweak.id);
      });
  };

  const resetAll = () => {
    setConfirming(false);
    if (busy) return;
    setBusy(true);
    optimize
      .resetTweaks()
      .then((r) => toast(resetMessage(r, tweakTitle, x)))
      .catch(() => toast(x.setFailed))
      .finally(() => {
        setBusy(false);
        readAgain(TOP);
      });
  };

  const openRestorePoint = () => {
    optimize.openTool('systemProtection').catch(() => toast(t.disk.tidy.windows.openFailed));
  };

  const groups = list ? groupTweaks(list) : [];
  const changed = list ? changedHere(list) : [];

  return (
    <div className={styles.tab}>
      <p ref={lead} tabIndex={-1} className={styles.lead}>
        {x.lead}
      </p>
      {changed.length > 0 ? (
        <div className={styles.bar}>
          <p className={styles.status}>{x.changedCount(changed.length)}</p>
          <div ref={resetWrap}>
            <Button onClick={() => (busy ? undefined : setConfirming(true))}>{x.resetAll}</Button>
          </div>
        </div>
      ) : null}
      {failed ? (
        <div className={styles.failed}>
          <p role="alert">{x.failed}</p>
          <Button
            onClick={() => {
              setFailed(false);
              readAgain(null);
            }}
          >
            {x.again}
          </Button>
        </div>
      ) : null}
      {!list && !failed ? (
        <div role="status">
          <span className="sr-only">{x.loading}</span>
          <Skeleton width="60%" height="1.25rem" />
        </div>
      ) : null}
      {list && groups.length === 0 ? <EmptyState title={x.none} /> : null}
      {groups.map((g) => (
        <section key={g.group} className={styles.group} aria-labelledby={`disk-tweaks-${g.group}`}>
          <h2 id={`disk-tweaks-${g.group}`}>{x.group[g.group]}</h2>
          <Card as="div">
            <ul className={styles.list} aria-busy={busy}>
              {g.items.map((tweak) => (
                <li
                  key={tweak.id}
                  ref={(el) => {
                    if (el) rows.current.set(tweak.id, el);
                    else rows.current.delete(tweak.id);
                  }}
                  className={styles.row}
                  data-testid={`tweak-${tweak.id}`}
                >
                  <Row tweak={tweak} onChange={(target) => change(tweak, target)} />
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ))}
      {groups.length > 0 ? (
        <div className={styles.foot}>
          <p className={styles.muted}>{x.restorePointHint}</p>
          <Button variant="ghost" onClick={openRestorePoint}>
            {x.restorePoint}
          </Button>
        </div>
      ) : null}
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

/**
 * The power plan: the select only chooses, "Übernehmen" applies. (A select that applies on change
 * would switch the plan of the whole PC on every arrow key.)
 */
function Choice({
  tweak,
  title,
  onApply,
}: {
  tweak: TweakState;
  title: string;
  onApply: (id: string) => void;
}) {
  const x = t.disk.tweaks;
  const [picked, setPicked] = useState<string | null>(null);
  // Whenever the active plan changes (applied, taken back, reset) the select shows it again.
  const [seen, setSeen] = useState(tweak.choice);
  if (seen !== tweak.choice) {
    setSeen(tweak.choice);
    setPicked(null);
  }
  const value = picked ?? tweak.choice ?? '';
  const same = value === (tweak.choice ?? '');
  return (
    <div className={styles.pair}>
      <SelectField
        label={x.chooseLabel(title)}
        labelHidden
        value={value}
        onChange={(e) => setPicked(e.currentTarget.value)}
      >
        {tweak.options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </SelectField>
      {/* Locked with `aria-disabled`, not `disabled`: the button keeps the focus after applying. */}
      <Button
        className={styles.apply}
        aria-label={x.applyLabel(title)}
        aria-disabled={same}
        onClick={() => (same ? undefined : onApply(value))}
      >
        {x.apply}
      </Button>
    </div>
  );
}

/** One setting: what it is, its control, and the folded details with risk and source. */
function Row({
  tweak,
  onChange,
}: {
  tweak: TweakState;
  onChange: (target: boolean | string) => void;
}) {
  const x = t.disk.tweaks;
  const title = tweakTitle(tweak.id);
  const state = switchState(tweak);
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
        <div className={styles.control} data-control>
          {state === 'unreadable' ? null : tweak.kind === 'choice' ? (
            <Choice tweak={tweak} title={title} onApply={onChange} />
          ) : state === 'default' || state === 'custom' ? (
            // No known state (Windows decides itself, or a value this catalogue cannot place):
            // no switch pretends to know it.
            <div className={styles.pair}>
              <Button size="sm" aria-label={x.turnOnLabel(title)} onClick={() => onChange(true)}>
                {x.turnOn}
              </Button>
              <Button size="sm" aria-label={x.turnOffLabel(title)} onClick={() => onChange(false)}>
                {x.turnOff}
              </Button>
            </div>
          ) : (
            <Switch
              label={title}
              labelHidden
              tone="neutral"
              checked={state === 'on'}
              onChange={onChange}
            />
          )}
        </div>
      </div>
      <p className={styles.state}>
        {state === 'unreadable'
          ? x.unreadable
          : tweak.kind === 'choice'
            ? x.stateChoice(choiceLabel(tweak))
            : state === 'default'
              ? x.windowsDefault
              : state === 'custom'
                ? x.customValue
                : state === 'on'
                  ? x.stateOn
                  : x.stateOff}
      </p>
      <details className={styles.more}>
        <summary aria-label={x.moreLabel(title)}>{x.more}</summary>
        <div className={styles.moreBody}>
          <p>{x.detail[tweak.id]}</p>
          {tweak.risk === 'low' ? (
            <p>
              {x.riskLow} {x.riskNote[tweak.id] ?? ''}
            </p>
          ) : null}
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
