import { useEffect, useMemo, useRef, useState } from 'react';
import { getPlatform } from '@/core/platform';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, Segmented, TextArea } from '@/ui';
import { copyText } from '../shared';
import styles from '../tools.module.css';
import { makeQr, qrPath, qrSvg, QrTooLongError, type QrMatrix } from './logic';

const s = t.tools.qr;

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type DetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike;

const detectorCtor = (): DetectorCtor | undefined =>
  (globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;

export default function QrTool() {
  const [mode, setMode] = useState<'create' | 'scan'>('create');
  return (
    <div className={styles.stack}>
      <Segmented
        label={s.mode}
        value={mode}
        options={[
          { value: 'create' as const, label: s.create },
          { value: 'scan' as const, label: s.scan },
        ]}
        onChange={setMode}
      />
      {mode === 'create' ? <Create /> : <Scan />}
    </div>
  );
}

function Create() {
  const [text, setText] = useState('');
  const result = useMemo<{ matrix?: QrMatrix; error?: string }>(() => {
    if (!text.trim()) return {};
    try {
      return { matrix: makeQr(text) };
    } catch (e) {
      return { error: e instanceof QrTooLongError ? s.tooLong : s.empty };
    }
  }, [text]);

  async function save() {
    if (!result.matrix) return;
    await getPlatform().saveFile({
      fileName: 'qr-code.svg',
      data: qrSvg(result.matrix),
      mime: 'image/svg+xml',
    });
  }

  const drawn = result.matrix ? qrPath(result.matrix) : undefined;
  return (
    <>
      <TextArea
        label={s.text}
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        data-autofocus
      />
      {result.error ? (
        <p className={styles.error} role="alert">
          {result.error}
        </p>
      ) : null}
      {drawn ? (
        <>
          <svg
            className={styles.qr}
            viewBox={`0 0 ${drawn.box} ${drawn.box}`}
            role="img"
            aria-label={s.alt}
            shapeRendering="crispEdges"
            data-testid="qr-code"
          >
            <rect width={drawn.box} height={drawn.box} fill="#fff" />
            <path d={drawn.path} fill="#000" />
          </svg>
          <div className={styles.row}>
            <Button onClick={() => void save()}>{s.download}</Button>
          </div>
        </>
      ) : null}
    </>
  );
}

function Scan() {
  const toast = useUiStore((st) => st.toast);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [found, setFound] = useState('');
  const [error, setError] = useState('');
  const supported = detectorCtor() !== undefined && !!navigator.mediaDevices?.getUserMedia;

  function stop() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setActive(false);
  }

  useEffect(() => {
    if (!active) return;
    const Detector = detectorCtor();
    if (!Detector) return;
    const detector = new Detector({ formats: ['qr_code'] });
    let alive = true;
    const timer = setInterval(() => {
      const el = video.current;
      if (!el || el.readyState < 2) return;
      void detector
        .detect(el)
        .then((codes) => {
          const value = codes[0]?.rawValue;
          if (alive && value) {
            setFound(value);
            stream.current?.getTracks().forEach((track) => track.stop());
            stream.current = null;
            setActive(false);
          }
        })
        .catch(() => undefined);
    }, 250);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [active]);

  // Never leave the camera on when the tool closes.
  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  async function start() {
    setError('');
    setFound('');
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      stream.current = media;
      setActive(true);
      // The <video> exists after this render; attach on the next tick.
      requestAnimationFrame(() => {
        if (video.current) {
          video.current.srcObject = media;
          void video.current.play().catch(() => undefined);
        }
      });
    } catch {
      setError(s.denied);
    }
  }

  if (!supported)
    return (
      <p className={styles.muted} role="status">
        {s.unsupported}
      </p>
    );

  const link = /^https?:\/\//i.test(found) ? found : undefined;
  return (
    <>
      {active ? (
        <>
          <video ref={video} className={styles.video} muted playsInline aria-label={s.scanning} />
          <p className={styles.muted} role="status">
            {s.scanning}
          </p>
          <div className={styles.row}>
            <Button onClick={stop}>{s.scanStop}</Button>
          </div>
        </>
      ) : (
        <div className={styles.row}>
          <Button variant="primary" onClick={() => void start()}>
            {s.scanStart}
          </Button>
        </div>
      )}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {found ? (
        <div className={styles.stack} data-testid="qr-found">
          <p className={styles.muted}>{s.found}</p>
          <p className={styles.mono}>{found}</p>
          <div className={styles.row}>
            <Button
              onClick={() => void copyText(found).then((ok) => ok && toast(t.tools.calc.copied))}
            >
              {s.copy}
            </Button>
            {link ? (
              <Button onClick={() => void getPlatform().app.openUrl(link)}>{s.openLink}</Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
