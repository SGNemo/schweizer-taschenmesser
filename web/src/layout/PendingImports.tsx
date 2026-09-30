/**
 * Imports an AI sent through the local API wait here for the user: a banner per waiting batch and
 * the review dialog (the shared preview with ticks and diffs). Nothing is stored before "Übernehmen".
 */
import { useEffect, useState } from 'react';
import {
  commitPendingBatch,
  rejectBatch,
  reviewRows,
  usePendingBatches,
} from '@/core/dataapi/pending';
import { countRecords } from '@/core/importer/batches';
import { ImportPreview } from '@/core/importer/ImportPreview';
import type { ImportBatch, PreviewRow } from '@/core/importer/types';
import { getManifest } from '@/core/modules/registry';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button, Dialog } from '@/ui';
import styles from './UpdateBanner.module.css';

export function PendingImports() {
  const pending = usePendingBatches();
  const [open, setOpen] = useState<ImportBatch | null>(null);
  if (!pending || pending.length === 0)
    return open ? <Review batch={open} onClose={() => setOpen(null)} /> : null;
  return (
    <>
      {pending.map((batch) => {
        const manifest = getManifest(batch.moduleId);
        const n = batch.rows?.length ?? 0;
        return (
          <section
            key={batch.id}
            className={styles.banner}
            aria-label={t.pendingImport.title}
            data-testid="pending-import"
          >
            <div className={styles.head}>
              <span className={styles.title}>
                {t.pendingImport.banner(batch.tokenName ?? '', n, manifest?.name ?? batch.moduleId)}
              </span>
              <div className={styles.actions}>
                <Button variant="primary" onClick={() => setOpen(batch)}>
                  {t.pendingImport.review}
                </Button>
              </div>
            </div>
          </section>
        );
      })}
      {open ? <Review batch={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function Review({ batch, onClose }: { batch: ImportBatch; onClose: () => void }) {
  const toast = useUiStore((s) => s.toast);
  const manifest = getManifest(batch.moduleId);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    if (manifest)
      void reviewRows(manifest, batch).then((r) => {
        if (alive) setRows(r);
      });
    return () => {
      alive = false;
    };
  }, [manifest, batch]);

  if (!manifest) return null;
  const selected = (rows ?? []).filter((r) => r.selected && !r.invalid);

  async function accept() {
    if (!manifest || !rows) return;
    setBusy(true);
    setError('');
    try {
      const done = await commitPendingBatch(
        manifest,
        batch.id,
        selected.map((r) => r.index),
      );
      toast(t.pendingImport.accepted(countRecords(done), done.conflicts ?? 0));
      onClose();
    } catch {
      setError(t.pendingImport.failed);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    try {
      await rejectBatch(batch.id);
      toast(t.pendingImport.rejected);
      onClose();
    } catch {
      setError(t.pendingImport.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t.pendingImport.dialogTitle(manifest.name)}
      footer={
        <>
          <Button variant="danger" disabled={busy} onClick={() => void reject()}>
            {t.pendingImport.reject}
          </Button>
          <Button
            variant="primary"
            disabled={busy || selected.length === 0}
            onClick={() => void accept()}
          >
            {t.pendingImport.accept(selected.length)}
          </Button>
        </>
      }
    >
      <p>{t.pendingImport.intro(batch.tokenName ?? '')}</p>
      {rows ? <ImportPreview rows={rows} onChange={setRows} /> : null}
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
