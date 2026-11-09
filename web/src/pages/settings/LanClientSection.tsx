import { useId, useState } from 'react';
import { getPlatform } from '@/core/platform';
import { syncNow, unpairFromPc } from '@/core/sync/service';
import { useSyncStatus } from '@/core/sync/status';
import { formatTimestamp } from '@/core/i18n/format';
import { formatDateTime } from '@/core/time/dates';
import { now, toDateString, today } from '@/core/time/now';
import { t } from '@/strings';
import { tLanSync } from '@/strings.lanSync';
import { Button, Dialog } from '@/ui';
import { Actions, Facts, StateBanner } from './ConnectParts';
import { SwitchToLanDialog } from './SwitchToLanDialog';
import { usePairWithPc } from './usePairWithPc';
import styles from './settings.module.css';

type Texts = ReturnType<typeof tLanSync.use>;

/**
 * Settings → Sync on the phone (and on a second PC once it is paired with the hub PC): pairing with
 * the hub PC by its QR (three steps, nothing typed) and the state of the home-network sync
 * (CONCEPT §2, §8). Calm: a PC out of reach is the normal case away
 * from home, so it is a neutral line; only the hub's authenticated "unpaired" and unreadable data get
 * the attention tone, each with the next step. Nothing here is red.
 */
export function LanClientSection({ tinted = true }: { tinted?: boolean }) {
  const l = tLanSync.use();
  const sync = useSyncStatus();
  const paired = sync.via === 'lanClient';
  const otherPath = sync.via === 'server' || sync.via === 'lanHub';
  const [switching, setSwitching] = useState(false);
  const [askUnpair, setAskUnpair] = useState(false);
  // "Jetzt abgleichen" was tapped: a round that does not reach the PC says so (not just the same line)
  const [tried, setTried] = useState(false);
  const wifiOnlyId = useId();
  // a second PC paired with the hub PC (webcam): its own words where the phone's would be wrong
  const pc = getPlatform().kind === 'desktop';
  const pairing = usePairWithPc(pc);
  const { step, failureInfo } = pairing;
  const progress = pairing.dialogs;

  const pairButton = (label: string) => (
    <Button
      variant="primary"
      onClick={pairing.start}
      disabled={step !== 'idle'}
      data-testid="lan-pair-pc"
    >
      {label}
    </Button>
  );

  const failureLine = failureInfo ? (
    <p role="status" className={styles.muted} data-testid="lan-pair-failure">
      {failureInfo.text}
    </p>
  ) : null;

  if (!paired) {
    return (
      <div className={styles.form} data-testid="lan-client">
        <StateBanner
          icon="sync"
          title={l.introPhone}
          line={otherPath ? l.otherPath : l.introPhoneLine}
          tinted={tinted}
          testId="lan-client-intro"
          action={
            sync.via === 'server' ? (
              <Button onClick={() => setSwitching(true)} data-testid="lan-switch-open">
                {l.switchToLan}
              </Button>
            ) : otherPath ? undefined : (
              pairButton(failureInfo?.again ?? l.pairWithPc)
            )
          }
        />
        {failureLine}
        {progress}
        <SwitchToLanDialog open={switching} onClose={() => setSwitching(false)} />
      </div>
    );
  }

  const banner = clientBanner(sync.phase, sync.error, sync.lastSyncAt, l, pc);
  // the phone reaches its PC only on Wi-Fi (`wifi` is unset where nobody watches it)
  const noWifi = sync.wifi === false;
  return (
    <div className={styles.form} data-testid="lan-client">
      <StateBanner
        icon={banner.tone === 'attention' ? 'alert' : 'sync'}
        tone={banner.tone}
        title={banner.title}
        line={banner.line}
        tinted={tinted}
        testId="lan-client-status"
        titleTestId="lan-client-state"
        action={banner.repair ? pairButton(failureInfo?.again ?? l.pairAgain) : undefined}
      />
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
      {longWithoutPc(sync.phase, sync.error, sync.lastSyncAt) ? (
        <p className={styles.muted} data-testid="lan-long-no-pc">
          {l.longNoPc}
        </p>
      ) : null}
      {failureLine}
      {tried && sync.phase === 'error' && sync.error === 'network' ? (
        <p role="status" className={styles.muted} data-testid="lan-tried">
          {l.triedNotReached}
        </p>
      ) : null}
      <Actions>
        <Button
          onClick={() => {
            setTried(true);
            void syncNow();
          }}
          disabled={sync.phase === 'syncing' || noWifi}
          aria-describedby={noWifi ? wifiOnlyId : undefined}
          data-testid="lan-sync-now"
        >
          {l.syncNow}
        </Button>
        <Button onClick={() => setAskUnpair(true)}>{l.unpair}</Button>
      </Actions>
      {noWifi ? (
        <p id={wifiOnlyId} className={styles.muted} data-testid="lan-wifi-only">
          {l.wifiOnly}
        </p>
      ) : null}
      {progress}
      <Dialog
        open={askUnpair}
        onClose={() => setAskUnpair(false)}
        title={l.unpair}
        footer={
          <>
            <Button onClick={() => setAskUnpair(false)}>{t.actions.cancel}</Button>
            <Button
              variant="primary"
              onClick={() => {
                setAskUnpair(false);
                void unpairFromPc();
              }}
            >
              {l.unpairConfirm}
            </Button>
          </>
        }
      >
        <p>{l.unpairFromPcAsk}</p>
      </Dialog>
    </div>
  );
}

function clientBanner(
  phase: string,
  error: string | undefined,
  lastSyncAt: number | undefined,
  l: Texts,
  pc: boolean,
): { title: string; line?: string; tone: 'ok' | 'neutral' | 'attention'; repair?: boolean } {
  if (phase === 'syncing') return { title: l.syncing, line: l.pairedWith, tone: 'ok' };
  if (phase === 'error') {
    if (error === 'revoked') return { title: l.revoked, tone: 'attention', repair: true };
    if (error === 'decrypt' || error === 'no-key')
      return { title: l.cannotRead, tone: 'attention', repair: true };
    // the same cases the badge does not call "waiting": each with its next step
    if (error === 'clock')
      return { title: pc ? l.clockOffPc : l.clockOff, line: l.clockLine, tone: 'attention' };
    if (error === 'server')
      return { title: l.pcUnexpected, line: l.pcUnexpectedLine, tone: 'attention' };
    // not reachable is the normal state away from home: neutral, with the one helpful question
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    return {
      title: l.waitingForPc,
      line: offline ? (pc ? l.offlineLinePc : l.offlineLine) : l.isNemoRunning,
      tone: 'neutral',
    };
  }
  // paired, but no round got through yet: say what is true
  if (!lastSyncAt) return { title: l.pairedWith, line: l.waitingForPc, tone: 'neutral' };
  return { title: l.synced, line: l.pairedWith, tone: 'ok' };
}

/** After 7 days without reaching the PC: one calm line (also on holiday, so no button; CONCEPT §8). */
const LONG_NO_PC_MS = 7 * 24 * 60 * 60 * 1000;

function longWithoutPc(phase: string, error: string | undefined, lastSyncAt?: number): boolean {
  return (
    phase === 'error' && error === 'network' && !!lastSyncAt && now() - lastSyncAt > LONG_NO_PC_MS
  );
}

/** "gerade eben", the time for today, the date from yesterday on (never "vor n Tagen"). */
function lastSyncedText(at: number | undefined, l: Texts): string {
  if (!at) return l.never;
  if (now() - at < 60_000) return l.justNow;
  return toDateString(new Date(at)) === today()
    ? formatTimestamp(at, { timeStyle: 'short' })
    : formatDateTime(at);
}
