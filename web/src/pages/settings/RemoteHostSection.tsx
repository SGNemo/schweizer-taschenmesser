import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { getPlatform } from '@/core/platform';
import type {
  RemoteHostDevice,
  RemoteHostGrant,
  RemoteHostPrograms,
  RemoteLevel,
} from '@/core/platform/types';
import { refreshRemoteHost, useRemoteHost, useRemoteHostWatch } from '@/core/remote/host';
import { settingsPath } from '@/core/settings/registry/paths';
import { formatDateTime } from '@/core/time/dates';
import { tRemoteHost } from '@/strings.remoteHost';
import { Badge, Button, SelectField, Switch } from '@/ui';
import { Actions, StateBanner, Step } from './ConnectParts';
import styles from './settings.module.css';

/**
 * What can be chosen here. Mouse and keyboard are offered together with the switch of their
 * notification (below the devices): the one must not exist without the other.
 */
const LEVELS: readonly RemoteLevel[] = ['off', 'media', 'full'];
type Texts = ReturnType<typeof tRemoteHost.use>;
type ErrorCode = keyof Texts['errors'];

/** What to say after a refused change. "Cancelled" is the person's own answer: nothing to say. */
function errorText(e: unknown, l: Texts): string | undefined {
  const code = e instanceof Error ? e.message : 'failed';
  if (code === 'cancelled') return undefined;
  return Object.hasOwn(l.errors, code) ? l.errors[code as ErrorCode] : l.errors.failed;
}

/** Most entries of the PC's program list (the shell refuses a ninth). */
const PROGRAMS_MAX = 8;

/**
 * Settings → Verbindungen → Fernsteuerung (desktop): which paired device may control this PC
 * (concept `docs/design/remote-control/CONCEPT.md` §4, rules `docs/rules/remote-control.md`).
 * Nothing here can widen by itself: the page only asks, the PC confirms in a Windows dialog. Calm
 * wording, never red; the off switch is the first control.
 */
export function RemoteHostSection() {
  const host = getPlatform().remoteHost;
  const l = tRemoteHost.use();
  useRemoteHostWatch(true);
  const { status, off } = useRemoteHost();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>();
  /** What was said about the notification switch: shown right below it, not far above. */
  const [noticeNote, setNoticeNote] = useState<string>();
  /**
   * The PC's program list (names only) and its epoch; `undefined` until read, or when it cannot
   * be read.
   */
  const [programList, setPrograms] = useState<RemoteHostPrograms>();
  const programs = programList?.list;
  /** What was said about the program list: shown right below it. */
  const [programNote, setProgramNote] = useState<string>();
  const running = !off && host.supported;
  useEffect(() => {
    if (!running) return;
    let alive = true;
    host
      .programs()
      .then((list) => {
        if (alive) setPrograms(list);
      })
      .catch(() => {
        if (alive) setPrograms(undefined);
      });
    return () => {
      alive = false;
    };
  }, [host, running]);
  // A Windows dialog can outlive this page: once it is gone, an answer changes nothing here and
  // must not fill the shared state again (nobody would keep it fresh).
  const open = useRef(true);
  useEffect(() => {
    open.current = true;
    return () => {
      open.current = false;
    };
  }, []);

  if (!host.supported) return null;

  /** One change at the PC, then a fresh reading whatever came of it. */
  async function change(
    action: () => Promise<unknown>,
    done?: string,
    say: (text: string | undefined) => void = setNote,
  ) {
    setNote(undefined);
    setNoticeNote(undefined);
    setProgramNote(undefined);
    setBusy(true);
    let said = done;
    try {
      await action();
    } catch (e) {
      said = errorText(e, l);
    }
    if (!open.current) return;
    await refreshRemoteHost();
    if (!open.current) return;
    // the list may have changed too (it is read with every change, never kept on its own)
    const list = await host.programs().catch(() => undefined);
    if (!open.current) return;
    setPrograms(list);
    say(said);
    setBusy(false);
  }

  if (off || !status) {
    return (
      <div className={styles.form} data-testid="remote-host">
        <StateBanner
          title={l.needHub}
          line={l.needHubLine}
          testId="remote-need-hub"
          action={<Link to={settingsPath('sync', 'sync')}>{l.toHub}</Link>}
        />
      </div>
    );
  }
  if (!status.supported) {
    return (
      <div className={styles.form} data-testid="remote-host">
        <p className={styles.muted} data-testid="remote-not-windows">
          {l.notWindows}
        </p>
      </div>
    );
  }

  /**
   * One field of a device's grant. The rest is taken from a reading made right now, not from what
   * is on screen: a device paused from the tray a moment ago stays paused, so a narrowing never
   * turns into a question.
   */
  const setGrant = (d: RemoteHostDevice, patch: Partial<RemoteHostGrant>) =>
    change(async () => {
      const fresh = await refreshRemoteHost();
      // no reading is not "unpaired": say that it did not work (or let the hub sentence take over)
      if (!fresh) throw new Error(useRemoteHost.getState().off ? 'not-started' : 'failed');
      const now = fresh.devices.find((x) => x.id === d.id);
      if (!now) throw new Error('not-found');
      await host.setDevice(d.id, {
        level: now.level,
        paused: now.paused,
        unlock: now.unlock,
        power: now.power,
        programs: now.programs,
        ...patch,
      });
    });
  const nameOf = (d: RemoteHostDevice) => d.name || l.unnamed(d.id.slice(0, 4));
  const hasGrant = status.devices.some((d) => d.level !== 'off');
  const controller = status.controller
    ? {
        ...status.controller,
        name: status.controller.name || l.unnamed(status.controller.id.slice(0, 4)),
      }
    : undefined;

  return (
    <div className={styles.form} data-testid="remote-host">
      <Switch
        label={l.allow}
        hint={
          status.enabled ? l.allowHintOn : hasGrant ? `${l.allowHint} ${l.askNote}` : l.allowHint
        }
        checked={status.enabled}
        disabled={busy}
        onChange={(on) => void change(() => host.setEnabled(on))}
      />
      {controller ? (
        <StateBanner
          icon="monitor"
          title={l.controlling(controller.name, controller.level)}
          line={l.endHint(controller.name)}
          testId="remote-controlling"
          action={
            <Button
              onClick={() => void change(() => host.end(), l.ended(controller.name))}
              disabled={busy}
              data-testid="remote-end"
            >
              {l.end}
            </Button>
          }
        />
      ) : null}
      {note ? (
        <p role="status" className={styles.muted} data-testid="remote-note">
          {note}
        </p>
      ) : null}

      <Step title={l.devices}>
        {status.devices.length === 0 ? (
          <p className={styles.muted}>
            {l.devicesNone} <Link to={settingsPath('sync', 'sync')}>{l.toHub}</Link>
          </p>
        ) : (
          <>
            <p className={styles.muted} data-testid="remote-hint">
              {status.enabled ? l.askNote : l.switchFirst}
            </p>
            {status.devices.map((d) => (
              <div key={d.id} className={styles.provider} data-testid="remote-device">
                <div className={styles.row}>
                  <strong>{nameOf(d)}</strong>
                  {d.paused ? <Badge>{l.paused}</Badge> : null}
                </div>
                <span className={styles.muted}>
                  {d.lastSeen ? l.lastSeen(formatDateTime(d.lastSeen * 1000)) : l.neverSeen}
                </span>
                {d.paused ? (
                  <>
                    <span className={styles.muted}>{l.pausedLine}</span>
                    <Actions>
                      <Button
                        onClick={() => void setGrant(d, { paused: false })}
                        disabled={busy || !status.enabled}
                        data-testid="remote-resume"
                      >
                        {l.resume}
                      </Button>
                    </Actions>
                  </>
                ) : (
                  <SelectField
                    label={l.levelLabel(nameOf(d))}
                    value={d.level}
                    disabled={busy || !status.enabled}
                    onChange={(e) => void setGrant(d, { level: e.target.value as RemoteLevel })}
                    data-testid="remote-level"
                  >
                    {LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {l.levels[level]}
                      </option>
                    ))}
                  </SelectField>
                )}
                {/* switching off is its own permission, offered once the device may do anything */}
                {!d.paused && d.level !== 'off' ? (
                  <Switch
                    label={l.power}
                    hint={l.powerHint}
                    checked={d.power}
                    disabled={busy || !status.enabled}
                    onChange={(on) => void setGrant(d, { power: on })}
                  />
                ) : null}
                {/* programs of the list below: a permission of the mouse/keyboard level */}
                {!d.paused && d.level === 'full' ? (
                  <Switch
                    label={l.programsAllow}
                    hint={l.programsAllowHint}
                    checked={d.programs}
                    disabled={busy || !status.enabled}
                    onChange={(on) => void setGrant(d, { programs: on })}
                  />
                ) : null}
                {/* the phone's own unlock: only mouse and keyboard ask for it */}
                {!d.paused && d.level === 'full' ? (
                  <Switch
                    label={l.unlock}
                    hint={l.unlockHint}
                    checked={d.unlock}
                    disabled={busy || !status.enabled}
                    onChange={(on) => void setGrant(d, { unlock: on })}
                  />
                ) : null}
              </div>
            ))}
          </>
        )}
      </Step>
      <Step title={l.programs.title}>
        <p className={styles.muted}>{l.programs.help}</p>
        {programs === undefined ? null : programs.length === 0 ? (
          <p className={styles.muted} data-testid="remote-programs-none">
            {l.programs.none}
          </p>
        ) : (
          <ul className={styles.plainList} data-testid="remote-programs">
            {programs.map((p) => (
              <li key={p.slot} className={styles.row} data-testid="remote-program">
                <span>{p.name}</span>
                <Button
                  variant="ghost"
                  onClick={() =>
                    void change(
                      // (the list's epoch: nothing is removed from a list that changed since)
                      () => host.removeProgram(p.slot, programList?.version ?? -1),
                      l.programs.removed(p.name),
                      setProgramNote,
                    )
                  }
                  disabled={busy}
                  aria-label={l.programs.removeLabel(p.name)}
                  data-testid="remote-program-remove"
                >
                  {l.programs.remove}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {programs !== undefined ? (
          <Actions>
            <Button
              onClick={() => void change(() => host.addProgram(), l.programs.added, setProgramNote)}
              disabled={busy || programs.length >= PROGRAMS_MAX}
              data-testid="remote-program-add"
            >
              {l.programs.add}
            </Button>
          </Actions>
        ) : null}
        {programs !== undefined && programs.length >= PROGRAMS_MAX ? (
          <p className={styles.muted}>{l.programs.full}</p>
        ) : null}
        {programNote ? (
          <p role="status" className={styles.muted} data-testid="remote-program-note">
            {programNote}
          </p>
        ) : null}
      </Step>
      <Switch
        label={l.notice}
        hint={l.noticeHint}
        checked={status.notice !== false}
        disabled={busy}
        onChange={(on) => void change(() => host.setNotice(on), undefined, setNoticeNote)}
      />
      {noticeNote ? (
        <p role="status" className={styles.muted} data-testid="remote-notice-note">
          {noticeNote}
        </p>
      ) : null}
    </div>
  );
}
