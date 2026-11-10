import { useState } from 'react';
import { Link } from 'react-router';
import { getPlatform } from '@/core/platform';
import type { RemoteHostDevice, RemoteHostGrant, RemoteLevel } from '@/core/platform/types';
import { refreshRemoteHost, useRemoteHost, useRemoteHostWatch } from '@/core/remote/host';
import { settingsPath } from '@/core/settings/registry/paths';
import { formatDateTime } from '@/core/time/dates';
import { tRemoteHost } from '@/strings.remoteHost';
import { Badge, Button, SelectField, Switch } from '@/ui';
import { Actions, StateBanner, Step } from './ConnectParts';
import styles from './settings.module.css';

/**
 * What can be chosen here. Mouse and keyboard are held back until they exist (package 3): nobody
 * should confirm in a Windows dialog what does nothing yet and would switch on silently later.
 */
const LEVELS: readonly RemoteLevel[] = ['off', 'media'];
type Texts = ReturnType<typeof tRemoteHost.use>;
type ErrorCode = keyof Texts['errors'];

/** What to say after a refused change. "Cancelled" is the person's own answer: nothing to say. */
function errorText(e: unknown, l: Texts): string | undefined {
  const code = e instanceof Error ? e.message : 'failed';
  if (code === 'cancelled') return undefined;
  return Object.hasOwn(l.errors, code) ? l.errors[code as ErrorCode] : l.errors.failed;
}

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

  if (!host.supported) return null;

  /** One change at the PC, then a fresh reading whatever came of it. */
  async function change(action: () => Promise<unknown>, done?: string) {
    setNote(undefined);
    setBusy(true);
    try {
      await action();
      setNote(done);
    } catch (e) {
      setNote(errorText(e, l));
    } finally {
      await refreshRemoteHost();
      setBusy(false);
    }
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
      const now = (await refreshRemoteHost())?.devices.find((x) => x.id === d.id);
      if (!now) throw new Error('not-found');
      await host.setDevice(d.id, {
        level: now.level,
        paused: now.paused,
        unlock: now.unlock,
        ...patch,
      });
    });
  const nameOf = (d: RemoteHostDevice) => d.name || l.unnamed(d.id.slice(0, 4));
  const hasGrant = status.devices.some((d) => d.level !== 'off');
  const controller = status.controller ?? undefined;

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
                    {/* a level set elsewhere stays visible, so the choice never shows a wrong value */}
                    {(LEVELS.includes(d.level) ? LEVELS : [...LEVELS, d.level]).map((level) => (
                      <option key={level} value={level}>
                        {l.levels[level]}
                      </option>
                    ))}
                  </SelectField>
                )}
              </div>
            ))}
          </>
        )}
      </Step>
    </div>
  );
}
