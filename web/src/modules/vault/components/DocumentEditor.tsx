import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { t } from '@/strings';
import { Button, Dialog, Form, FormActions, SelectField, Split, TextArea, TextField } from '@/ui';
import { formatSize, MAX_FILE_BYTES } from '../logic';
import { deleteDocument, saveDocument } from '../repo';
import { CATEGORIES, type DocCategory, type VaultDocument } from '../schema';

export type DocumentTarget = Stored<VaultDocument> | { draft: true } | null;

export function DocumentEditor({
  target,
  onClose,
}: {
  target: DocumentTarget;
  onClose: () => void;
}) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog open={target !== null} onClose={onClose} title={existing ? t.vault.edit : t.vault.add}>
      {target ? <Fields key={existing?.id ?? 'new'} existing={existing} onClose={onClose} /> : null}
    </Dialog>
  );
}

function Fields({
  existing,
  onClose,
}: {
  existing: Stored<VaultDocument> | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [category, setCategory] = useState<DocCategory>(existing?.category ?? 'other');
  const [expiresOn, setExpiresOn] = useState(existing?.expiresOn ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [file, setFile] = useState<File | 'remove' | undefined>();
  const [error, setError] = useState('');

  async function save() {
    await saveDocument(
      existing?.id ?? null,
      {
        title: title.trim(),
        category,
        expiresOn: expiresOn || undefined,
        note: note.trim() || undefined,
        fileName: existing?.fileName,
        fileType: existing?.fileType,
        fileSize: existing?.fileSize,
      },
      file,
    );
    onClose();
  }

  const shownFile =
    file instanceof File
      ? `${file.name} (${formatSize(file.size)})`
      : file === 'remove' || !existing?.fileName
        ? undefined
        : `${existing.fileName}${existing.fileSize !== undefined ? ` (${formatSize(existing.fileSize)})` : ''}`;

  return (
    <Form onSubmit={() => void save()}>
      <TextField
        label={t.form.title}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        data-autofocus
      />
      <Split>
        <SelectField
          label={t.vault.category}
          value={category}
          onChange={(e) => setCategory(e.target.value as DocCategory)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t.vault.categories[c]}
            </option>
          ))}
        </SelectField>
        <TextField
          label={t.vault.expiresOn}
          type="date"
          value={expiresOn}
          onChange={(e) => setExpiresOn(e.target.value)}
        />
      </Split>
      <TextArea label={t.form.note} value={note} onChange={(e) => setNote(e.target.value)} />
      <div>
        <TextField
          label={t.vault.file}
          hint={t.vault.localOnly}
          type="file"
          error={error}
          onChange={(e) => {
            const picked = e.target.files?.[0];
            if (!picked) return;
            if (picked.size > MAX_FILE_BYTES) {
              e.target.value = '';
              return setError(t.vault.tooLarge(formatSize(MAX_FILE_BYTES)));
            }
            setError('');
            setFile(picked);
          }}
        />
        {shownFile ? (
          <p style={{ margin: 'var(--space-2) 0 0' }}>
            {shownFile}{' '}
            <Button variant="ghost" onClick={() => setFile('remove')}>
              {t.vault.removeFile}
            </Button>
          </p>
        ) : null}
      </div>
      <FormActions
        start={
          existing ? (
            <Button
              variant="danger"
              onClick={async () => {
                await deleteDocument(existing.id);
                onClose();
              }}
            >
              {t.actions.delete}
            </Button>
          ) : undefined
        }
      >
        <Button onClick={onClose}>{t.actions.cancel}</Button>
        <Button type="submit" variant="primary">
          {t.actions.save}
        </Button>
      </FormActions>
    </Form>
  );
}
