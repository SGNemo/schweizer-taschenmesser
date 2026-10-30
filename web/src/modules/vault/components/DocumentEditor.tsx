import { NoticeField } from '@/core/deadline/NoticeField';
import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { t } from '@/strings';
import { tDraft } from '@/strings.draft';
import { deleteWithUndo } from '@/core/undo/withToast';
import {
  Button,
  Dialog,
  Form,
  FormActions,
  SelectField,
  Split,
  TextArea,
  TextField,
  useFormDraft,
} from '@/ui';
import { endOf, formatSize, MAX_FILE_BYTES } from '../logic';
import { deleteDocument, saveDocument } from '../repo';
import { CATEGORIES, documentSchema, type DocCategory, type VaultDocument } from '../schema';

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
  // Typed text survives Esc or a tap beside the dialog (in memory, 30 minutes); "Abbrechen" and
  // saving drop it.
  const dr = tDraft.use();
  const draft = useFormDraft(`vault:document:${existing?.id ?? 'new'}`, {
    title: existing?.title ?? '',
    category: (existing?.category ?? 'other') as DocCategory,
    provider: existing?.provider ?? '',
    startDate: existing?.startDate ?? '',
    endDate: (existing && endOf(existing)) ?? '',
    notice: existing?.noticeDays as number | undefined,
    note: existing?.note ?? '',
  });
  const { title, category, provider, startDate, endDate, notice, note } = draft.values;
  const setTitle = (v: string) => draft.set('title', v);
  const setCategory = (v: DocCategory) => draft.set('category', v);
  const setProvider = (v: string) => draft.set('provider', v);
  const setStartDate = (v: string) => draft.set('startDate', v);
  const setEndDate = (v: string) => draft.set('endDate', v);
  const setNotice = (v: number | undefined) => draft.set('notice', v);
  const setNote = (v: string) => draft.set('note', v);
  const [dateError, setDateError] = useState('');
  const [file, setFile] = useState<File | 'remove' | undefined>();
  const [error, setError] = useState('');

  async function save() {
    const parsed = documentSchema.safeParse({
      title: title.trim(),
      category,
      provider: provider.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      noticeDays: notice,
      note: note.trim() || undefined,
      fileName: existing?.fileName,
      fileType: existing?.fileType,
      fileSize: existing?.fileSize,
    });
    if (!parsed.success) return setDateError(t.vault.invalid);
    await saveDocument(existing?.id ?? null, parsed.data, file);
    draft.clear();
    onClose();
  }
  const cancel = () => {
    draft.clear();
    onClose();
  };

  const shownFile =
    file instanceof File
      ? `${file.name} (${formatSize(file.size)})`
      : file === 'remove' || !existing?.fileName
        ? undefined
        : `${existing.fileName}${existing.fileSize !== undefined ? ` (${formatSize(existing.fileSize)})` : ''}`;

  return (
    <Form onSubmit={() => void save()}>
      {draft.restored ? (
        <p role="status" data-testid="draft-restored">
          {dr.restored}{' '}
          <Button variant="ghost" onClick={draft.discard}>
            {dr.discard}
          </Button>
        </p>
      ) : null}
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
          label={t.vault.provider}
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        />
      </Split>
      <Split>
        <TextField
          label={t.vault.startDate}
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <TextField
          label={t.vault.endDate}
          type="date"
          value={endDate}
          onChange={(e) => {
            setEndDate(e.target.value);
            setDateError('');
          }}
          error={dateError}
        />
      </Split>
      <NoticeField days={notice} onChange={setNotice} max={730} />
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
                // No question: the toast offers "Rückgängig"; the file stays until it is restorable no more.
                await deleteWithUndo(() => deleteDocument(existing.id));
                draft.clear();
                onClose();
              }}
            >
              {t.actions.delete}
            </Button>
          ) : undefined
        }
      >
        <Button onClick={cancel}>{t.actions.cancel}</Button>
        <Button type="submit" variant="primary">
          {t.actions.save}
        </Button>
      </FormActions>
    </Form>
  );
}
