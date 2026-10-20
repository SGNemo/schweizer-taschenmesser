import { useEffect, useRef, useState } from 'react';
import { getPlatform } from '@/core/platform';
import { now } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, Checkbox } from '@/ui';
import styles from '../tools.module.css';
import { canShareImage, captureFrame, copyImage, shareImage } from './capture';
import {
  canCaptureScreen,
  CAPTURE_DELAY_SECONDS,
  classifyCaptureError,
  screenshotFileName,
} from './logic';

const s = t.tools.screenshot;

interface Shot {
  blob: Blob;
  url: string;
  width: number;
  height: number;
}

/** One button: pick a screen, window or tab, get the picture, save or copy it. The picture lives only on this page. */
export default function ScreenshotTool() {
  const toast = useUiStore((st) => st.toast);
  const [shot, setShot] = useState<Shot | undefined>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [delayed, setDelayed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const stopped = useRef(false);
  const supported = canCaptureScreen();

  useEffect(() => () => (shot ? URL.revokeObjectURL(shot.url) : undefined), [shot]);

  async function take() {
    setBusy(true);
    setMessage('');
    stopped.current = false;
    try {
      const frame = await captureFrame({
        delaySeconds: delayed ? CAPTURE_DELAY_SECONDS : 0,
        onTick: setSecondsLeft,
        cancelled: () => stopped.current,
      });
      setShot({ ...frame, url: URL.createObjectURL(frame.blob) });
    } catch (e) {
      const kind = classifyCaptureError(e);
      setMessage(
        kind === 'cancelled' ? s.cancelled : kind === 'unsupported' ? s.unsupported : s.failed,
      );
    } finally {
      setBusy(false);
      setSecondsLeft(0);
    }
  }

  async function save() {
    if (!shot) return;
    await getPlatform().saveFile({
      fileName: screenshotFileName(new Date(now())),
      data: shot.blob,
      mime: 'image/png',
    });
  }

  async function copy() {
    if (!shot) return;
    toast((await copyImage(shot.blob)) ? s.copied : s.copyFailed);
  }

  async function share() {
    if (!shot) return;
    await shareImage(shot.blob, screenshotFileName(new Date(now())));
  }

  if (!supported)
    return (
      <p className={styles.muted} data-testid="screenshot-unsupported">
        {s.unsupported}
      </p>
    );

  return (
    <div className={styles.stack}>
      <p className={styles.muted}>{s.hint}</p>
      <div className={styles.row}>
        <Button variant="primary" onClick={() => void take()} disabled={busy} data-autofocus>
          {shot ? s.again : s.take}
        </Button>
        <Checkbox
          label={s.delay(CAPTURE_DELAY_SECONDS)}
          checked={delayed}
          disabled={busy}
          onChange={(e) => setDelayed(e.target.checked)}
        />
      </div>
      {secondsLeft > 0 ? (
        <div className={styles.row}>
          <p role="status" className={styles.muted} data-testid="screenshot-countdown">
            {s.countdown(secondsLeft)}
          </p>
          <Button variant="ghost" onClick={() => (stopped.current = true)}>
            {s.stop}
          </Button>
        </div>
      ) : null}
      {message ? (
        <p role="status" className={styles.muted}>
          {message}
        </p>
      ) : null}
      {shot ? (
        <>
          <img
            src={shot.url}
            alt={s.alt(shot.width, shot.height)}
            data-testid="screenshot-preview"
            style={{ maxWidth: '100%', height: 'auto' }}
          />
          <div className={styles.row}>
            <Button onClick={() => void save()}>{s.save}</Button>
            <Button onClick={() => void copy()}>{s.copy}</Button>
            {canShareImage() ? <Button onClick={() => void share()}>{s.share}</Button> : null}
            <Button variant="ghost" onClick={() => setShot(undefined)}>
              {s.discard}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
