import { useEffect, useRef, useState } from 'react';
import { t } from '@/strings';
import { Button, Dialog, Form, FormActions, TextField } from '@/ui';
import { isEan } from '../logic';
import styles from './ScanDialog.module.css';

interface DetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type DetectorCtor = new (opts: { formats: string[] }) => DetectorLike;

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

/** The browser's own barcode detector (Chrome on Android, macOS); where it is missing, typing the number still works. */
const detectorCtor = (): DetectorCtor | undefined =>
  (globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;

/**
 * Scan a product barcode with the camera (the video never leaves the device, nothing is looked up online) or type the
 * number. The caller decides what a number means: the item that has it gets one more, an unknown number starts a new item.
 */
export function ScanDialog({
  open,
  onClose,
  onCode,
}: {
  open: boolean;
  onClose: () => void;
  onCode: (code: string) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={t.pantry.scan.title}>
      {open ? <Body onCode={onCode} onClose={onClose} /> : null}
    </Dialog>
  );
}

function Body({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const s = t.pantry.scan;
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const [typed, setTyped] = useState('');
  const [typedError, setTypedError] = useState('');
  const supported = detectorCtor() !== undefined && !!navigator.mediaDevices?.getUserMedia;

  const stop = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setActive(false);
  };

  useEffect(() => {
    if (!active) return;
    const Detector = detectorCtor();
    if (!Detector) return;
    const detector = new Detector({ formats: FORMATS });
    let alive = true;
    const timer = setInterval(() => {
      const el = video.current;
      if (!el || el.readyState < 2) return;
      void detector
        .detect(el)
        .then((codes) => {
          const value = codes.map((c) => c.rawValue).find(isEan);
          if (alive && value) {
            stop();
            onCode(value);
          }
        })
        .catch(() => undefined);
    }, 250);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [active, onCode]);

  // The camera is never left on when the dialog closes.
  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  async function start() {
    setError('');
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      stream.current = media;
      setActive(true);
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

  return (
    <div className={styles.body}>
      {supported ? (
        active ? (
          <>
            <video ref={video} className={styles.video} muted playsInline aria-label={s.scanning} />
            <p role="status">{s.scanning}</p>
            <Button onClick={stop}>{s.stop}</Button>
          </>
        ) : (
          <Button variant="primary" onClick={() => void start()}>
            {s.start}
          </Button>
        )
      ) : (
        <p role="status">{s.unsupported}</p>
      )}
      {error ? <p role="alert">{error}</p> : null}
      <Form
        onSubmit={() => {
          const code = typed.replace(/\s+/g, '');
          if (!isEan(code)) return setTypedError(s.badCode);
          onCode(code);
        }}
      >
        <TextField
          label={s.typed}
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value);
            setTypedError('');
          }}
          error={typedError}
          inputMode="numeric"
          autoComplete="off"
        />
        <FormActions>
          <Button onClick={onClose}>{t.actions.cancel}</Button>
          <Button type="submit" variant="primary">
            {s.use}
          </Button>
        </FormActions>
      </Form>
    </div>
  );
}
