import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getBlob } from '@/core/blobs';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { Button } from '@/ui';
import { ATTACHMENT_ACCEPT, attachmentKey, isAttachable, MAX_ATTACHMENT_BYTES } from '../pay';
import type { Invoice } from '../schema';
import styles from '../routes/invoices.module.css';

export type AttachmentChoice = { kind: 'keep' } | { kind: 'remove' } | { kind: 'new'; file: File };

/**
 * The file of an invoice (PDF or photo). It stays in the device-local blob store: the note about it
 * is synced, the file is not, and the text says so. A photo is shown inline; a PDF opens or is saved.
 * Choices apply when the dialog is saved.
 */
export function AttachmentSection({
  invoiceId,
  meta,
  choice,
  onChoice,
}: {
  invoiceId: string | null;
  meta: Invoice['attachment'];
  choice: AttachmentChoice;
  onChoice: (c: AttachmentChoice) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const e = t.invoices.ext.attachment;

  // The file to show: the one just chosen, else the stored one (none on another device).
  const stored = useLiveQuery(
    async () =>
      choice.kind === 'keep' && meta && invoiceId ? getBlob(attachmentKey(invoiceId)) : undefined,
    [choice.kind, meta, invoiceId],
  );
  const blob = choice.kind === 'new' ? choice.file : choice.kind === 'keep' ? stored : undefined;
  // An object URL lives as long as its file is shown.
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : undefined), [blob]);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  const shown =
    choice.kind === 'new'
      ? { name: choice.file.name, mime: choice.file.type }
      : choice.kind === 'keep' && meta
        ? meta
        : undefined;

  function pick(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!isAttachable(file.type)) return setError(e.wrongType);
    if (file.size > MAX_ATTACHMENT_BYTES)
      return setError(e.tooBig(`${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB`));
    setError('');
    onChoice({ kind: 'new', file });
  }

  return (
    <section className={styles.attachBox} aria-label={e.label}>
      <h3 className={styles.sectionTitle}>{e.label}</h3>
      <input
        ref={input}
        type="file"
        accept={ATTACHMENT_ACCEPT}
        hidden
        onChange={(ev) => {
          pick(ev.target.files);
          ev.target.value = '';
        }}
      />
      {shown ? (
        <>
          <p>{e.previewOf(shown.name)}</p>
          {url && shown.mime.startsWith('image/') ? (
            <img className={styles.attachImage} src={url} alt={e.previewOf(shown.name)} />
          ) : null}
          {url ? (
            <div className={styles.attachActions}>
              {shown.mime === 'application/pdf' ? (
                <Button variant="ghost" onClick={() => window.open(url, '_blank', 'noopener')}>
                  {e.open}
                </Button>
              ) : null}
              <Button
                variant="ghost"
                onClick={() =>
                  void blob?.arrayBuffer().then((data) =>
                    getPlatform().saveFile({
                      fileName: shown.name,
                      data: new Uint8Array(data),
                      mime: shown.mime,
                    }),
                  )
                }
              >
                {e.save}
              </Button>
            </div>
          ) : (
            <p className={styles.muted}>{choice.kind === 'keep' ? e.otherDevice : ''}</p>
          )}
        </>
      ) : null}
      <div className={styles.attachActions}>
        <Button variant="ghost" onClick={() => input.current?.click()}>
          {shown ? e.replace : e.add}
        </Button>
        {shown ? (
          <Button variant="ghost" onClick={() => onChoice({ kind: 'remove' })}>
            {e.remove}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className={styles.muted}>
          {error}
        </p>
      ) : null}
      <p className={styles.muted}>{e.localOnly}</p>
    </section>
  );
}
