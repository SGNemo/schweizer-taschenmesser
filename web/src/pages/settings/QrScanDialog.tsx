import { useEffect, useRef } from 'react';
import { t } from '@/strings';
import { tLanSync } from '@/strings.lanSync';
import { Button, Dialog } from '@/ui';
import styles from './settings.module.css';

export type ScanFailure = 'camera-denied' | 'scan-failed';

/** Largest frame edge that is decoded: enough for a QR on a PC screen, cheap on a phone. */
const FRAME_EDGE = 720;
const EVERY_MS = 200;

/**
 * The phone's QR scanner inside the app: the camera stream in a `<video>`, frames decoded with jsQR
 * (lazy). No native scanner view: nothing can cover the app without a way back, and a camera that
 * fails is a calm line, never a crash. The camera is off again as soon as the dialog closes.
 */
export function QrScanDialog(props: {
  onResult: (text: string) => void;
  onCancel: () => void;
  onFailure: (reason: ScanFailure) => void;
}) {
  const l = tLanSync.use();
  const video = useRef<HTMLVideoElement>(null);
  // the callbacks of the render that opened the dialog are enough (they only end it)
  const done = useRef(props);

  useEffect(() => {
    let alive = true;
    // closed by the user: a late failure is not reported
    let closed = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      alive = false;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };

    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        const [media, decoder] = await Promise.all([
          navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }),
          import('jsqr').then((m) => m.default),
        ]);
        stream = media;
        if (!alive) return stop();
        const el = video.current;
        if (!el) return stop();
        el.srcObject = media;
        await el.play().catch(() => undefined);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('no-canvas');
        timer = setInterval(() => {
          if (!alive || el.readyState < 2 || !el.videoWidth) return;
          const scale = Math.min(1, FRAME_EDGE / Math.max(el.videoWidth, el.videoHeight));
          canvas.width = Math.round(el.videoWidth * scale);
          canvas.height = Math.round(el.videoHeight * scale);
          ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = decoder(frame.data, frame.width, frame.height, {
            inversionAttempts: 'attemptBoth',
          });
          if (code?.data) {
            stop();
            done.current.onResult(code.data);
          }
        }, EVERY_MS);
      } catch (e) {
        const denied =
          e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
        stop();
        if (closed) return;
        done.current.onFailure(denied ? 'camera-denied' : 'scan-failed');
      }
    })();

    return () => {
      closed = true;
      stop();
    };
  }, []);

  return (
    <Dialog
      open
      onClose={props.onCancel}
      title={l.scanTitle}
      footer={<Button onClick={props.onCancel}>{t.actions.cancel}</Button>}
    >
      <div className={styles.form} data-testid="lan-scan">
        <video
          ref={video}
          className={styles.scanVideo}
          muted
          playsInline
          aria-label={l.scanTitle}
        />
        <p className={styles.muted} role="status">
          {l.scanHint}
        </p>
      </div>
    </Dialog>
  );
}
