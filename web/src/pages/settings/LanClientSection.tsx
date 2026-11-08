import { useState } from 'react';
import { getPlatform } from '@/core/platform';
import {
  cancelPairing,
  pairWithPc,
  syncNow,
  unpairFromPc,
  type PairFailure,
} from '@/core/sync/service';
import { useSyncStatus } from '@/core/sync/status';
import { now } from '@/core/time/now';
import { formatDateTime } from '@/core/time/dates';
import { t } from '@/strings';
import { tLanSync } from '@/strings.lanSync';
import { Button, Dialog } from '@/ui';
import { Actions, Facts, StateBanner } from './ConnectParts';
import styles from './settings.module.css';

type Texts = ReturnType<typeof tLanSync.use>;

/**
 * Settings → Sync on the phone: pairing with the hub PC by its QR (three steps, nothing typed) and
 * the state of the home-network sync (CONCEPT §2, §8). Calm: a PC out of reach is the normal case away
 * from home, so it is a neutral line; only the hub's authenticated "unpaired" and unreadable data get
 * the attention tone, each with the next step.
 */
export function LanClientSection({ tinted = true }: { tinted?: boolean }) {
  const l = tLanSync.use();
  const sync = useSyncStatus();
  const paired = sync.via === 'lanClient';
  const otherPath = sync.via === 'server' || sync.via === 'lanHub';
  const [step, setStep] = useState<'idle' | 'scanning' | 'connecting' | 'confirm'>('idle');
  const [code, setCode] = useState<string>();
  const [failure, setFailure] = useState<PairFailure>();
  const [askUnpair, setAskUnpair] = useState(false);

  async function startPairing() {
    setFailure(undefined);
    setCode(undefined);
    setStep('scanning');
    let qr: string;
    try {
      qr = await getPlatform().lanClient.scan();
    } catch (e) {
      setStep('idle');
      const reason = e instanceof Error ? e.message : '';
      // the user closed the camera: nothing to report
      if (reason !== 'cancelled') setFailure(reason === 'camera-denied' ? 'unsupported' : 'failed');
      return;
    }
    setStep('connecting');
    const result = await pairWithPc(
      qr,
      t.sync.deviceNames[getPlatform().kind] ?? t.sync.defaultDeviceName,
      (c) => {
        setCode(c);
        setStep('confirm');
      },
    );
    setStep('idle');
    if (!result.ok && result.reason !== 'cancelled') setFailure(result.reason);
  }

  const failureText = failure ? pairFailureText(failure, l) : undefined;
  const pairButton = (
    <Button
      variant="primary"
      onClick={() => void startPairing()}
      disabled={step !== 'idle'}
      data-testid="lan-pair-pc"
    >
      {paired ? l.pairAgain : l.pairWithPc}
    </Button>
  );

  const progress =
    step === 'idle' ? null : (
      <Dialog
        open
        onClose={() => void cancelPairing()}
        title={l.pairWithPc}
        footer={<Button onClick={() => void cancelPairing()}>{t.actions.cancel}</Button>}
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
    );

  if (!paired) {
    return (
      <div className={styles.form} data-testid="lan-client">
        <StateBanner
          icon="sync"
          title={l.introPhone}
          line={otherPath ? l.otherPath : l.introPhoneLine}
          tinted={tinted}
          testId="lan-client-intro"
          action={otherPath ? undefined : pairButton}
        />
        {failureText ? (
          <p role="alert" className={styles.error} data-testid="lan-pair-failure">
            {failureText}
          </p>
        ) : null}
        {progress}
      </div>
    );
  }

  const banner = clientBanner(sync.phase, sync.error, l);
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
        action={banner.repair ? pairButton : undefined}
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
      {failureText ? (
        <p role="alert" className={styles.error} data-testid="lan-pair-failure">
          {failureText}
        </p>
      ) : null}
      <Actions>
        <Button onClick={() => void syncNow()} disabled={sync.phase === 'syncing'}>
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
  l: Texts,
): { title: string; line?: string; tone: 'ok' | 'neutral' | 'attention'; repair?: boolean } {
  if (phase === 'syncing') return { title: l.syncing, line: l.pairedWith, tone: 'ok' };
  if (phase === 'error') {
    if (error === 'revoked') return { title: l.revoked, tone: 'attention', repair: true };
    if (error === 'decrypt' || error === 'no-key')
      return { title: l.cannotRead, tone: 'attention', repair: true };
    // not reachable is the normal state away from home: neutral, with the one helpful question
    return { title: l.waitingForPc, line: l.isNemoRunning, tone: 'neutral' };
  }
  return { title: l.synced, line: l.pairedWith, tone: 'ok' };
}

function pairFailureText(reason: PairFailure, l: Texts): string {
  switch (reason) {
    case 'bad-qr':
      return l.badQr;
    case 'pairing-not-possible':
      return l.notPossible;
    case 'network':
      return l.pcNotFound;
    case 'unsupported':
      return l.cameraOff;
    case 'other-path':
      return l.otherPath;
    default:
      return l.pairFailed;
  }
}

/** "482913" → "482 913": easier to compare between two screens. */
const groupCode = (code: string): string =>
  code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;

function lastSyncedText(at: number | undefined, l: Texts): string {
  if (!at) return l.never;
  return now() - at < 60_000 ? l.justNow : formatDateTime(at);
}
