import { useRef, useState, type ReactNode } from 'react';
import { getPlatform } from '@/core/platform';
import { cancelPairing, pairWithPc, type PairFailure } from '@/core/sync/service';
import { t } from '@/strings';
import { tLanSync } from '@/strings.lanSync';
import { Button, Dialog } from '@/ui';
import { QrScanDialog, type ScanFailure } from './QrScanDialog';
import styles from './settings.module.css';

type Texts = ReturnType<typeof tLanSync.use>;
export type PairWithPcFailure = PairFailure | ScanFailure;

/**
 * Pairing this device with a hub PC by its QR (scan → code → confirmed on the PC), shared by the phone
 * (`LanClientSection`) and a second PC (`LanHubSection`, "Mit einem anderen PC koppeln", webcam).
 * `dialogs` must be rendered by the caller; a failure is a calm line (`failureInfo`), never red.
 */
export function usePairWithPc(pc: boolean): {
  step: 'idle' | 'scanning' | 'connecting' | 'confirm';
  start: () => void;
  failure: PairWithPcFailure | undefined;
  failureInfo: { text: string; again: string } | undefined;
  dialogs: ReactNode;
} {
  const l = tLanSync.use();
  const [step, setStep] = useState<'idle' | 'scanning' | 'connecting' | 'confirm'>('idle');
  const [code, setCode] = useState<string>();
  const [failure, setFailure] = useState<PairWithPcFailure>();
  // A cancelled attempt may still answer late: only the current one may change the screen.
  const attempt = useRef(0);

  async function startPairing() {
    const mine = ++attempt.current;
    setFailure(undefined);
    setCode(undefined);
    setStep('scanning');
    const scan = getPlatform().lanClient?.scan;
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
          : reason === 'camera-denied' || reason === 'no-camera'
            ? reason
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

  // The app's own camera while scanning (a platform scanner shows its own view instead).
  const scanning =
    step === 'scanning' && !getPlatform().lanClient?.scan ? (
      <QrScanDialog
        hint={pc ? l.scanHintPc : undefined}
        onResult={(qr) => void connect(attempt.current, qr)}
        onCancel={() => {
          attempt.current++;
          setStep('idle');
        }}
        onFailure={(reason) => scanEnded(attempt.current, reason)}
      />
    ) : null;

  const dialogs =
    step === 'connecting' || step === 'confirm' ? (
      <Dialog
        open
        onClose={cancel}
        title={pc ? l.pairWithOtherPc : l.pairWithPc}
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

  return {
    step,
    start: () => void startPairing(),
    failure,
    failureInfo: failure ? pairFailure(failure, l, pc) : undefined,
    dialogs,
  };
}

/** The words for a failed pairing and the label of the button that tries again. */
export function pairFailure(
  reason: PairWithPcFailure,
  l: Texts,
  pc: boolean,
): { text: string; again: string } {
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
      return { text: pc ? l.cameraDeniedPc : l.cameraDenied, again: l.tryAgain };
    case 'no-camera':
      return { text: l.noCamera, again: l.tryAgain };
    case 'other-path':
      return { text: l.otherPath, again: l.pairWithPc };
    case 'hub-on':
      return { text: l.isHubAlready, again: l.tryAgain };
    case 'keystore':
      return { text: pc ? l.keystorePc : l.keystorePhone, again: l.tryAgain };
    default:
      return { text: l.pairFailed, again: l.tryAgain };
  }
}

/** "482913" → "482 913": easier to compare between two screens. */
const groupCode = (code: string): string =>
  code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
