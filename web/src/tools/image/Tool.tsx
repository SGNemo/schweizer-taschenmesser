import { useEffect, useRef, useState } from 'react';
import { getPlatform } from '@/core/platform';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, SelectField, TextField } from '@/ui';
import { num } from '../shared';
import styles from '../tools.module.css';
import { convert, decode, type Converted } from './convert';
import {
  CROP_RATIOS,
  FORMATS,
  formatOf,
  humanSize,
  outName,
  type CropRatio,
  type OutType,
} from './logic';

const s = t.tools.image;

export default function ImageTool() {
  const [file, setFile] = useState<File | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const bitmap = useRef<ImageBitmap | null>(null);
  const [type, setType] = useState<OutType>('image/webp');
  const [quality, setQuality] = useState(85);
  const [maxSide, setMaxSide] = useState('1920');
  const [crop, setCrop] = useState<CropRatio>('none');
  const [result, setResult] = useState<(Converted & { url: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useUiStore((st) => st.toast);

  // The preview URL is created with the result and released when it is replaced or the tool closes.
  const liveUrl = useRef<string | null>(null);
  const setResultWithUrl = (r: Converted | null) => {
    if (liveUrl.current) URL.revokeObjectURL(liveUrl.current);
    liveUrl.current = r ? URL.createObjectURL(r.blob) : null;
    setResult(r && liveUrl.current ? { ...r, url: liveUrl.current } : null);
  };
  useEffect(
    () => () => {
      if (liveUrl.current) URL.revokeObjectURL(liveUrl.current);
    },
    [],
  );

  useEffect(() => () => bitmap.current?.close(), []);

  async function pick(f: File | undefined) {
    setResultWithUrl(null);
    setError(null);
    bitmap.current?.close();
    bitmap.current = null;
    setFile(f ?? null);
    setDims(null);
    if (!f) return;
    try {
      const bmp = await decode(f);
      bitmap.current = bmp;
      setDims({ w: bmp.width, h: bmp.height });
    } catch {
      setError(s.failed);
    }
  }

  async function run() {
    if (!bitmap.current) return;
    setBusy(true);
    setError(null);
    try {
      setResultWithUrl(
        await convert(bitmap.current, {
          type,
          quality: quality / 100,
          maxSide: num(maxSide),
          crop,
        }),
      );
    } catch {
      setResultWithUrl(null);
      setError(s.encodeFailed);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!result || !file) return;
    const r = await getPlatform().saveFile({
      fileName: outName(file.name, type),
      data: result.blob,
      mime: type,
    });
    if (r === 'saved') toast(s.saved);
  }

  const pct = result && file ? Math.round((1 - result.blob.size / file.size) * 100) : 0;

  return (
    <div className={styles.stack}>
      <div>
        <label htmlFor="image-input">{s.pick}</label>
        <br />
        <input
          id="image-input"
          type="file"
          accept="image/*"
          onChange={(e) => void pick(e.target.files?.[0])}
        />
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {file && dims ? (
        <>
          <p className={styles.muted} data-testid="image-source">
            {s.source(dims.w, dims.h, humanSize(file.size))}
          </p>
          <div className={styles.row}>
            <div className={styles.grow}>
              <SelectField
                label={s.format}
                value={type}
                onChange={(e) => setType(e.target.value as OutType)}
              >
                {FORMATS.map((f) => (
                  <option key={f.type} value={f.type}>
                    {f.label}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className={styles.grow}>
              <TextField
                label={s.maxSide}
                hint={s.maxSideHint}
                value={maxSide}
                onChange={(e) => setMaxSide(e.target.value)}
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.grow}>
              <SelectField
                label={s.crop}
                value={crop}
                onChange={(e) => setCrop(e.target.value as CropRatio)}
              >
                {CROP_RATIOS.map((r) => (
                  <option key={r} value={r}>
                    {r === 'none' ? s.cropNone : r}
                  </option>
                ))}
              </SelectField>
            </div>
            {formatOf(type).lossy ? (
              <div className={styles.grow}>
                <label htmlFor="image-quality">
                  {s.quality}: {quality} %
                </label>
                <input
                  id="image-quality"
                  type="range"
                  min={40}
                  max={100}
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                />
              </div>
            ) : null}
          </div>
          <div className={styles.row}>
            <Button variant="primary" onClick={() => void run()} disabled={busy}>
              {s.convert}
            </Button>
          </div>
        </>
      ) : null}
      {result && file ? (
        <div className={styles.stack} data-testid="image-result">
          <p role="status">
            {s.result(
              result.width,
              result.height,
              humanSize(result.blob.size),
              formatOf(type).label,
            )}
          </p>
          <p className={styles.muted}>{pct > 0 ? s.smaller(pct) : s.larger}</p>
          {result.url ? (
            <img
              src={result.url}
              alt={s.preview}
              style={{ maxWidth: '100%', maxHeight: '16rem', objectFit: 'contain' }}
            />
          ) : null}
          <div className={styles.row}>
            <Button onClick={() => void save()}>{s.save}</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
