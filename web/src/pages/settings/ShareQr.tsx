import { useEffect, useMemo, useRef, useState } from 'react';
import { createFrameCollector, MANY_FRAMES } from '@/core/share/frames';
import toolStyles from '@/tools/tools.module.css';
import { makeQr, qrPath } from '@/tools/qr/logic';
import { tShare } from '@/strings.share';
import { Button } from '@/ui';
import styles from './settings.module.css';

const FRAME_MS = 450;
const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The file as a run of QR codes, one after the other. Starts paused when motion is reduced. */
export function QrPlayer({ frames, onDone }: { frames: string[]; onDone: () => void }) {
  const n = tShare.use();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % frames.length), FRAME_MS);
    return () => clearInterval(timer);
  }, [playing, frames.length]);

  const drawn = useMemo(() => qrPath(makeQr(frames[index]!)), [frames, index]);
  return (
    <div className={styles.form} data-testid="share-qr-player">
      <svg
        className={toolStyles.qr}
        viewBox={`0 0 ${drawn.box} ${drawn.box}`}
        role="img"
        aria-label={n.qrAlt(index + 1, frames.length)}
        shapeRendering="crispEdges"
      >
        <path d={drawn.path} />
      </svg>
      <p role="status" className={styles.muted} data-testid="share-qr-frame">
        {n.qrFrame(index + 1, frames.length)}
      </p>
      {frames.length > MANY_FRAMES ? (
        <p className={styles.muted}>{n.qrLarge(frames.length)}</p>
      ) : null}
      <p className={styles.muted}>{n.qrHint}</p>
      <div className={styles.row}>
        <Button onClick={() => setPlaying((p) => !p)}>{playing ? n.qrPause : n.qrPlay}</Button>
        <Button disabled={playing} onClick={() => setIndex((i) => (i + 1) % frames.length)}>
          {n.qrNext}
        </Button>
        <Button variant="primary" onClick={onDone}>
          {n.qrDone}
        </Button>
      </div>
    </div>
  );
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type DetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike;

const detectorCtor = (): DetectorCtor | undefined =>
  (globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;

export const canScanQr = (): boolean =>
  detectorCtor() !== undefined && !!navigator.mediaDevices?.getUserMedia;

/** Reads the run of QR codes with the camera (where the browser can read QR codes) and hands over the text. */
export function QrScanner({
  onText,
  onStop,
}: {
  onText: (text: string) => void;
  onStop: () => void;
}) {
  const n = tShare.use();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [progress, setProgress] = useState<{ have: number; total: number } | undefined>();
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const Detector = detectorCtor();
    const collector = createFrameCollector();
    let timer: ReturnType<typeof setInterval> | undefined;
    const release = () => {
      if (timer) clearInterval(timer);
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
    };
    void (async () => {
      try {
        if (!Detector) throw new Error('unsupported');
        const media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (!alive) return media.getTracks().forEach((track) => track.stop());
        stream.current = media;
        if (video.current) {
          video.current.srcObject = media;
          void video.current.play().catch(() => undefined);
        }
        const detector = new Detector({ formats: ['qr_code'] });
        timer = setInterval(() => {
          const el = video.current;
          if (!el || el.readyState < 2) return;
          void detector
            .detect(el)
            .then((codes) => {
              for (const code of codes) {
                if (!alive) return;
                const result = collector.add(code.rawValue);
                if (result.state === 'collecting') setProgress(result);
                if (result.state === 'broken') setError(n.errors.invalid!);
                if (result.state === 'done') {
                  alive = false;
                  release();
                  onText(result.text);
                  return;
                }
              }
            })
            .catch(() => undefined);
        }, 200);
      } catch {
        if (alive) setError(n.qrDenied);
      }
    })();
    return () => {
      alive = false;
      release();
    };
    // The camera starts once per opening; the callbacks only hand results upwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.form} data-testid="share-qr-scanner">
      <video ref={video} className={toolStyles.video} muted playsInline aria-label={n.qrScanning} />
      <p role="status" className={styles.muted}>
        {progress ? n.qrProgress(progress.have, progress.total) : n.qrScanning}
      </p>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      <div className={styles.row}>
        <Button onClick={onStop}>{n.qrStop}</Button>
      </div>
    </div>
  );
}
