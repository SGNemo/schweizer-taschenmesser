import { useEffect, useMemo, useState } from 'react';
import { getPlatform } from '@/core/platform';
import type { LanHubDevice, LanHubStatus } from '@/core/platform/types';
import {
  disableLanHub,
  enableLanHub,
  renewLanHubKey,
  syncNow,
  type LanHubFailure,
} from '@/core/sync/service';
import { useSyncStatus } from '@/core/sync/status';
import { now } from '@/core/time/now';
import { formatDateTime } from '@/core/time/dates';
import { writePrefs } from '@/quickCapture/device';
import { tLanSync } from '@/strings.lanSync';
import { t } from '@/strings';
import toolStyles from '@/tools/tools.module.css';
import { makeQr, qrPath } from '@/tools/qr/logic';
import { Button, Dialog, Switch } from '@/ui';
import { Actions, Facts, StateBanner, Step } from './ConnectParts';
import { FoldedGroup } from './FoldedGroup';
import styles from './settings.module.css';

const LONG_UNSEEN_MS = 90 * 24 * 3600_000;
const POLL_MS = 5000;
const POLL_PAIRING_MS = 1000;

/**
 * Settings → Sync on the desktop app: this PC as the home-network hub (concept
 * `docs/design/sync-lan/CONCEPT.md` §2, §8). States from the hub (`lan_hub_status`), calm wording,
 * never red: problems use the attention tone with text and a next step.
 */
export function LanHubSection({ tinted = true }: { tinted?: boolean }) {
  const hub = getPlatform().lanHub;
  const l = tLanSync.use();
  const sync = useSyncStatus();
  const enabled = sync.via === 'lanHub';
  const serverOn = sync.via === 'server';
  const [status, setStatus] = useState<LanHubStatus>();
  const [devices, setDevices] = useState<LanHubDevice[]>([]);
  const [pairing, setPairing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [note, setNote] = useState<string>();
  const [unpair, setUnpair] = useState<LanHubDevice>();
  const [askRenew, setAskRenew] = useState(false);
  const [askHome, setAskHome] = useState(false);

  // The hub's state is read while this page is open: often while a pairing window is open, else calmly.
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const read = async () => {
      try {
        const [s, d] = await Promise.all([hub.status(), hub.devices()]);
        if (!alive) return;
        setStatus(s);
        setDevices(d);
      } catch {
        // not started yet (the sync round starts it); the next read catches up
      }
    };
    void read();
    const timer = setInterval(() => void read(), pairing ? POLL_PAIRING_MS : POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [enabled, pairing, hub]);

  const failureText = (reason: LanHubFailure): string =>
    reason === 'keystore'
      ? l.keystore
      : reason === 'server-connected'
        ? l.serverFirst
        : l.startFailed;

  async function startPairing() {
    setFailure(undefined);
    setNote(undefined);
    setBusy(true);
    try {
      if (!enabled) {
        const result = await enableLanHub();
        if (!result.ok) return setFailure(failureText(result.reason));
      }
      try {
        await hub.pairOpen();
      } catch (e) {
        // `busy`: a window is already open (another tab or an earlier click): just show it
        if (!(e instanceof Error && e.message === 'busy')) return setFailure(l.startFailed);
      }
      setStatus(await hub.status().catch(() => undefined));
      setPairing(true);
    } finally {
      setBusy(false);
    }
  }

  async function confirmUnpair() {
    const device = unpair;
    setUnpair(undefined);
    if (!device) return;
    const changed = await hub.revoke(device.id).catch(() => false);
    if (changed) {
      setNote(l.unpaired(device.name));
      setDevices(await hub.devices().catch(() => devices));
    }
  }

  async function confirmRenew() {
    setAskRenew(false);
    setNote((await renewLanHubKey()) ? l.renewed : l.renewFailed);
  }

  async function confirmHome() {
    setAskHome(false);
    await hub.setHome().catch(() => undefined);
    setStatus(await hub.status().catch(() => status));
  }

  if (!hub.supported) return null;

  if (!enabled) {
    return (
      <div className={styles.form} data-testid="lan-hub">
        <StateBanner
          icon="sync"
          title={l.introPc}
          line={serverOn ? l.serverFirst : l.introPcLine}
          tinted={tinted}
          testId="lan-hub-intro"
          action={
            serverOn ? undefined : (
              <Button
                variant="primary"
                onClick={() => void startPairing()}
                disabled={busy}
                data-testid="lan-pair"
              >
                {l.pairDevice}
              </Button>
            )
          }
        />
        {failure ? (
          <p role="status" className={styles.muted} data-testid="lan-hub-failure">
            {failure}
          </p>
        ) : null}
        <PairDialog open={pairing} status={status} onClose={() => setPairing(false)} />
      </div>
    );
  }

  const active = devices.filter((d) => !d.revoked);
  const banner = hubBanner(status, active.length, l);

  return (
    <div className={styles.form} data-testid="lan-hub">
      <StateBanner
        icon={banner.tone === 'attention' ? 'alert' : 'sync'}
        tone={banner.tone}
        title={banner.title}
        line={banner.line}
        tinted={tinted}
        testId="lan-hub-status"
        titleTestId="lan-hub-state"
        action={
          <Button
            variant="primary"
            onClick={() => void startPairing()}
            disabled={busy}
            data-testid="lan-pair"
          >
            {l.pairDevice}
          </Button>
        }
      />
      {banner.reason === 'no-home' ? (
        <Actions>
          <Button onClick={() => setAskHome(true)} data-testid="lan-new-router">
            {l.newRouter}
          </Button>
        </Actions>
      ) : null}
      <Facts
        label={l.title}
        items={[
          {
            label: l.lastSynced,
            value: lastSyncedText(sync.lastSyncAt, l),
            testId: 'lan-last-sync',
          },
          ...(sync.pending > 0
            ? [{ label: l.notYetSynced, value: l.changes(sync.pending), testId: 'lan-pending' }]
            : []),
        ]}
      />
      {sync.phase === 'error' ? (
        <p className={styles.muted} data-testid="lan-sync-error">
          {t.sync.errors[sync.error ?? 'unknown']}
        </p>
      ) : null}
      <Actions>
        <Button onClick={() => void syncNow()} disabled={sync.phase === 'syncing'}>
          {l.syncNow}
        </Button>
      </Actions>
      {failure ? (
        <p role="status" className={styles.muted}>
          {failure}
        </p>
      ) : null}
      {note ? (
        <p role="status" className={styles.muted} data-testid="lan-note">
          {note}
        </p>
      ) : null}

      <Step title={l.devices}>
        {active.length === 0 ? (
          <p className={styles.muted}>{l.devicesNone}</p>
        ) : (
          active.map((d) => {
            const seenMs = d.lastSeen ? d.lastSeen * 1000 : undefined;
            const longUnseen = seenMs !== undefined && now() - seenMs > LONG_UNSEEN_MS;
            return (
              <div key={d.id} className={styles.provider} data-testid="lan-device">
                <div className={styles.row}>
                  <strong>{d.name}</strong>
                </div>
                <span className={styles.muted}>
                  {seenMs ? l.lastSeen(formatDateTime(seenMs)) : l.neverSeen}
                </span>
                {longUnseen ? <span className={styles.muted}>{l.longUnseen}</span> : null}
                <div className={styles.row}>
                  <Button onClick={() => setUnpair(d)}>{l.unpair}</Button>
                </div>
              </div>
            );
          })
        )}
      </Step>

      <FoldedGroup id="lan-more" section="sync" title={l.more} current={[]}>
        <div className={styles.form}>
          <Actions>
            <Button onClick={() => setAskRenew(true)}>{l.renewKey}</Button>
          </Actions>
          <Actions>
            <Button onClick={() => void disableLanHub()} data-testid="lan-off">
              {l.turnOff}
            </Button>
          </Actions>
          <p className={styles.muted}>{l.turnOffHint}</p>
        </div>
      </FoldedGroup>

      <PairDialog open={pairing} status={status} onClose={() => setPairing(false)} />
      <Ask
        open={unpair !== undefined}
        text={l.unpairAsk(unpair?.name ?? '')}
        confirm={l.unpairConfirm}
        onCancel={() => setUnpair(undefined)}
        onConfirm={() => void confirmUnpair()}
      />
      <Ask
        open={askRenew}
        text={l.renewKeyAsk}
        confirm={l.renewKeyConfirm}
        onCancel={() => setAskRenew(false)}
        onConfirm={() => void confirmRenew()}
      />
      <Ask
        open={askHome}
        text={l.newRouterAsk}
        confirm={l.use}
        onCancel={() => setAskHome(false)}
        onConfirm={() => void confirmHome()}
      />
    </div>
  );
}

type Texts = ReturnType<typeof tLanSync.use>;

function hubBanner(
  status: LanHubStatus | undefined,
  devices: number,
  l: Texts,
): { title: string; line?: string; tone: 'ok' | 'neutral' | 'attention'; reason?: string } {
  if (!status || status.state === 'listening')
    return { title: l.hubOn(devices), line: l.hubOnLine, tone: 'ok' };
  if (status.state === 'failed') return { title: l.failed, tone: 'attention' };
  switch (status.reason) {
    case 'public-network':
      return { title: l.blocked, line: l.blockedLine, tone: 'attention' };
    case 'no-home':
      return { title: l.onlyHome, line: l.onlyHomeLine, tone: 'neutral', reason: 'no-home' };
    case 'no-network':
      return { title: l.noNetwork, line: l.noNetworkLine, tone: 'neutral' };
    case 'unreadable':
      return { title: l.failed, tone: 'attention' };
    default:
      return { title: l.notListening, line: l.notListeningLine, tone: 'neutral' };
  }
}

/** "482913" → "482 913": easier to compare between two screens. */
const groupCode = (code: string): string =>
  code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;

function lastSyncedText(at: number | undefined, l: Texts): string {
  if (!at) return l.never;
  return now() - at < 60_000 ? l.justNow : formatDateTime(at);
}

function Ask(props: {
  open: boolean;
  text: string;
  confirm: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={props.open}
      onClose={props.onCancel}
      title={props.confirm}
      footer={
        <>
          <Button onClick={props.onCancel}>{t.actions.cancel}</Button>
          <Button variant="primary" onClick={props.onConfirm}>
            {props.confirm}
          </Button>
        </>
      }
    >
      <p>{props.text}</p>
    </Dialog>
  );
}

/**
 * The pairing window: a large QR (renewed by the hub, no countdown), the firewall hint, and – once a
 * device knocked – its name and the 6-digit code to compare. Closing cancels the window.
 */
function PairDialog({
  open,
  status,
  onClose,
}: {
  open: boolean;
  status: LanHubStatus | undefined;
  onClose: () => void;
}) {
  const l = tLanSync.use();
  const hub = getPlatform().lanHub;
  const desktop = getPlatform().desktop;
  const [paired, setPaired] = useState<string>();
  const [error, setError] = useState<string>();
  const [autostart, setAutostart] = useState(true);
  const [tray, setTray] = useState(true);

  // A new window starts clean (state adjusted during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPaired(undefined);
      setError(undefined);
    }
  }

  const qr = status?.qr ?? undefined;
  const drawn = useMemo(() => (qr ? qrPath(makeQr(qr)) : undefined), [qr]);
  const pending = status?.pending ?? undefined;

  async function close() {
    if (!paired) await hub.pairCancel().catch(() => undefined);
    onClose();
  }

  async function confirm() {
    if (!pending) return;
    setError(undefined);
    try {
      await hub.pairConfirm(pending.attempt, pending.code);
      setPaired(pending.name);
      void syncNow();
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setError(
        code === 'wrong-code' ? l.wrongCode : code === 'expired' ? l.pairExpired : l.pairLost,
      );
    }
  }

  async function reject() {
    // Cancel this attempt and show a fresh code: the device that knocked is not trusted.
    await hub.pairCancel().catch(() => undefined);
    await hub.pairOpen().catch(() => undefined);
  }

  async function finish() {
    if (desktop.supported) {
      writePrefs({ autostart, closeToTray: tray });
      await desktop.setAutostart(autostart).catch(() => undefined);
      await desktop.setCloseToTray(tray).catch(() => undefined);
    }
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={() => void close()}
      title={l.pairTitle}
      footer={
        paired ? (
          <Button variant="primary" onClick={() => void finish()} data-testid="lan-pair-done">
            {l.done}
          </Button>
        ) : (
          <Button onClick={() => void close()}>{l.close}</Button>
        )
      }
    >
      <div className={styles.form} data-testid="lan-pair-dialog">
        {paired ? (
          <>
            <p role="status" data-testid="lan-paired">
              {l.paired(paired)}
            </p>
            {desktop.supported ? (
              <>
                <p className={styles.muted}>{l.keepRunning}</p>
                <Switch label={l.autostart} checked={autostart} onChange={setAutostart} />
                <Switch label={l.tray} checked={tray} onChange={setTray} />
              </>
            ) : null}
          </>
        ) : pending ? (
          <>
            <p data-testid="lan-pair-ask">
              <strong>{l.pairAsk(pending.name, groupCode(pending.code))}</strong>
            </p>
            <p className={styles.muted}>{l.pairCheck(pending.name)}</p>
            {error ? (
              <p role="status" className={styles.muted}>
                {error}
              </p>
            ) : null}
            <Actions>
              <Button
                variant="primary"
                onClick={() => void confirm()}
                data-testid="lan-pair-confirm"
              >
                {l.pairConfirm}
              </Button>
              <Button onClick={() => void reject()}>{t.actions.cancel}</Button>
            </Actions>
          </>
        ) : (
          <>
            <p className={styles.muted}>{l.pairSteps}</p>
            {drawn ? (
              <svg
                className={toolStyles.qr}
                viewBox={`0 0 ${drawn.box} ${drawn.box}`}
                role="img"
                aria-label={l.qrAlt}
                shapeRendering="crispEdges"
                data-testid="lan-pair-qr"
              >
                <path d={drawn.path} />
              </svg>
            ) : status?.reason === 'public-network' ? (
              <p className={styles.muted}>{l.blockedLine}</p>
            ) : (
              <p className={styles.muted} data-testid="lan-pair-preparing">
                {l.preparing}
              </p>
            )}
            <p className={styles.muted}>{l.firewall}</p>
          </>
        )}
      </div>
    </Dialog>
  );
}
