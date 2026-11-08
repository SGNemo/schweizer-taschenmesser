import { useRef, useState } from 'react';
import { getPlatform } from '@/core/platform';
import {
  cancelPairing,
  pairWithPc,
  syncNow,
  unpairFromPc,
  type PairFailure,
} from '@/core/sync/service';
import { useSyncStatus } from '@/core/sync/status';
import { formatTimestamp } from '@/core/i18n/format';
import { formatDateTime } from '@/core/time/dates';
import { now, toDateString, today } from '@/core/time/now';
import { t } from '@/strings';
import { tLanSync } from '@/strings.lanSync';
import { Button, Dialog } from '@/ui';
import { Actions, Facts, StateBanner } from './ConnectParts';
import { QrScanDialog, type ScanFailure } from './QrScanDialog';
import styles from './settings.module.css';

type Texts = ReturnType<typeof tLanSync.use>;
type Failure = PairFailure | ScanFailure;

/**
 * Settings → Sync on the phone: pairing with the hub PC by its QR (three steps, nothing typed) and
 * the state of the home-network sync (CONCEPT §2, §8). Calm: a PC out of reach is the normal case away
 * from home, so it is a neutral line; only the hub's authenticated "unpaired" and unreadable data get
 * the attention tone, each with the next step. Nothing here is red.
 */
export function LanClientSection({ tinted = true }: { tinted?: boolean }) {
  const l = tLanSync.use();
  const sync = useSyncStatus();
  const paired = sync.via === 'lanClient';
  const otherPath = sync.via === 'server' || sync.via === 'lanHub';
  const [step, setStep] = useState<'idle' | 'scanning' | 'connecting' | 'confirm'>('idle');
  const [code, setCode] = useState<string>();
  const [failure, setFailure] = useState<Failure>();
  const [askUnpair, setAskUnpair] = useState(false);
  // "Jetzt abgleichen" was tapped: a round that does not reach the PC says so (not just the same line)
  const [tried, setTried] = useState(false);
  // A cancelled attempt may still answer late: only the current one may change the screen.
  const attempt = useRef(0);

  async function startPairing() {
    const mine = ++attempt.current;
    setFailure(undefined);
    setCode(undefined);
    setStep('scanning');
    const scan = getPlatform().lanClient.scan;
    // no scanner of the platform: the app's own camera dialog opens (rendered below)
    if (!scan) return;
    let qr: string;
    try {
      qr = await scan();
    } catch (e) {
      if (attempt.current !== mine) return;
      const reason = e instanceof Error ? e.message : '';
      // the user closed the camera: nothing to report
      scanEnded(
        mine,
        reason === 'cancelled'
          ? undefined
          : reason === 'camera-denied'
            ? 'camera-denied'
            : 'scan-failed',
      );
      return;
    }
    await connect(mine, qr);
  }

  function scanEnded(mine: number, reason: ScanFailure | undefined) {
    if (attempt.current !== mine) return;
    setStep('idle');
    if (reason) setFailure(reason);
  }

  async function connect(mine: number, qr: string) {
    if (attempt.current !== mine) return;
    setStep('connecting');
    const result = await pairWithPc(
      qr,
      t.sync.deviceNames[getPlatform().kind] ?? t.sync.defaultDeviceName,
      (c) => {
        if (attempt.current !== mine) return;
        setCode(c);
        setStep('confirm');
      },
    );
    if (attempt.current !== mine) return;
    setStep('idle');
    if (!result.ok && result.reason !== 'cancelled') setFailure(result.reason);
  }

  function cancel() {
    // the dialog closes at once; the shell stops waiting in the background
    attempt.current++;
    setStep('idle');
    void cancelPairing();
  }

  const failureInfo = failure ? pairFailure(failure, l) : undefined;
  const pairButton = (label: string) => (
    <Button
      variant="primary"
      onClick={() => void startPairing()}
      disabled={step !== 'idle'}
      data-testid="lan-pair-pc"
    >
      {label}
    </Button>
  );

  // The app's own camera while scanning (a platform scanner shows its own view instead).
  const scanning =
    step === 'scanning' && !getPlatform().lanClient.scan ? (
      <QrScanDialog
        onResult={(qr) => void connect(attempt.current, qr)}
        onCancel={() => {
          attempt.current++;
          setStep('idle');
        }}
        onFailure={(reason) => scanEnded(attempt.current, reason)}
      />
    ) : null;

  const progress =
    step === 'connecting' || step === 'confirm' ? (
      <Dialog
        open
        onClose={cancel}
        title={l.pairWithPc}
        footer={<Button onClick={cancel}>{t.actions.cancel}</Button>}
      >
        <div className={styles.form} data-testid="lan-pair-progress">
          {step === 'confirm' && code ? (
            <>
              <p data-testid="lan-confirm-on-pc">
                <strong>{l.confirmOnPc(groupCode(code))}</strong>
              </p>
              <p className={styles.muted}>{l.confirmOnPcLine}</p>
            </>
          ) : (
            <p className={styles.muted}>{l.connecting}</p>
          )}
        </div>
      </Dialog>
    ) : (
      scanning
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
          action={otherPath ? undefined : pairButton(failureInfo?.again ?? l.pairWithPc)}
        />
        {failureLine}
        {progress}
      </div>
    );
  }

  const banner = clientBanner(sync.phase, sync.error, sync.lastSyncAt, l);
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
          disabled={sync.phase === 'syncing'}
        >
          {l.syncNow}
        </Button>
        <Button onClick={() => setAskUnpair(true)}>{l.unpair}</Button>
      </Actions>
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
): { title: string; line?: string; tone: 'ok' | 'neutral' | 'attention'; repair?: boolean } {
  if (phase === 'syncing') return { title: l.syncing, line: l.pairedWith, tone: 'ok' };
  if (phase === 'error') {
    if (error === 'revoked') return { title: l.revoked, tone: 'attention', repair: true };
    if (error === 'decrypt' || error === 'no-key')
      return { title: l.cannotRead, tone: 'attention', repair: true };
    // the same cases the badge does not call "waiting": each with its next step
    if (error === 'clock') return { title: l.clockOff, line: l.clockLine, tone: 'attention' };
    if (error === 'server')
      return { title: l.pcUnexpected, line: l.pcUnexpectedLine, tone: 'attention' };
    // not reachable is the normal state away from home: neutral, with the one helpful question
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    return {
      title: l.waitingForPc,
      line: offline ? l.offlineLine : l.isNemoRunning,
      tone: 'neutral',
    };
  }
  // paired, but no round got through yet: say what is true
  if (!lastSyncAt) return { title: l.pairedWith, line: l.waitingForPc, tone: 'neutral' };
  return { title: l.synced, line: l.pairedWith, tone: 'ok' };
}

/** The words for a failed pairing and the label of the button that tries again. */
function pairFailure(reason: Failure, l: Texts): { text: string; again: string } {
  switch (reason) {
    case 'bad-qr':
      return { text: l.badQr, again: l.scanAgain };
    case 'pairing-not-possible':
      return { text: l.notPossible, again: l.scanAgain };
    case 'pairing-aborted':
      return { text: l.pairAborted, again: l.tryAgain };
    case 'network':
      return { text: l.pcNotFound, again: l.tryAgain };
    case 'camera-denied':
      return { text: l.cameraDenied, again: l.tryAgain };
    case 'other-path':
      return { text: l.otherPath, again: l.pairWithPc };
    case 'keystore':
      return { text: l.keystorePhone, again: l.tryAgain };
    default:
      return { text: l.pairFailed, again: l.tryAgain };
  }
}

/** "482913" → "482 913": easier to compare between two screens. */
const groupCode = (code: string): string =>
  code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;

/** "gerade eben", the time for today, the date from yesterday on (never "vor n Tagen"). */
function lastSyncedText(at: number | undefined, l: Texts): string {
  if (!at) return l.never;
  if (now() - at < 60_000) return l.justNow;
  return toDateString(new Date(at)) === today()
    ? formatTimestamp(at, { timeStyle: 'short' })
    : formatDateTime(at);
}
