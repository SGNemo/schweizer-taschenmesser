import { changedFields } from '@/core/db/patch';
import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { t } from '@/strings';
import {
  AdvancedFields,
  Button,
  Dialog,
  Form,
  FormActions,
  SelectField,
  TextArea,
  TextField,
} from '@/ui';
import { formatTags, normalizeUrl, parseTags } from '../logic';
import { fetchPreviewFor, previewEnabled } from '../preview';
import { itemRepo } from '../repo';
import { KINDS, type BookmarkItem, type Kind } from '../schema';
import { deleteWithUndo } from '@/core/undo/withToast';

export type ItemTarget =
  Stored<BookmarkItem> | { draft: true; title?: string; url?: string; kind?: Kind } | null;

export function ItemEditor({ target, onClose }: { target: ItemTarget; onClose: () => void }) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={existing ? t.bookmarks.edit : t.bookmarks.add}
    >
      {target ? <Fields key={existing?.id ?? 'new'} target={target} onClose={onClose} /> : null}
    </Dialog>
  );
}

function Fields({ target, onClose }: { target: NonNullable<ItemTarget>; onClose: () => void }) {
  const existing = 'id' in target ? target : null;
  const draft = !existing ? (target as { title?: string; url?: string; kind?: Kind }) : {};
  // The record as the editor opened it: only fields that differ from it are saved (QA X01).
  const [opened] = useState(existing);
  const [title, setTitle] = useState(existing?.title ?? draft.title ?? '');
  const [url, setUrl] = useState(existing?.url ?? draft.url ?? '');
  const [kind, setKind] = useState<Kind>(existing?.kind ?? draft.kind ?? 'link');
  const [tags, setTags] = useState(formatTags(existing?.tags ?? []));
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState('');

  async function save() {
    const address = url.trim() ? normalizeUrl(url) : undefined;
    if (url.trim() && !address) return setError(t.bookmarks.urlInvalid);
    const data = {
      title: title.trim() || (address ? new URL(address).host : ''),
      url: address,
      kind,
      tags: parseTags(tags),
      note: note.trim() || undefined,
      done: existing?.done ?? false,
      started: existing?.started ?? false,
    };
    // A new address (or a new item) gets its preview when the setting is on; a stale one is dropped.
    const addressChanged = !existing || existing.url !== address;
    const saved = existing
      ? (await itemRepo.update(
          existing.id,
          changedFields(
            opened ?? existing,
            addressChanged ? { ...data, preview: undefined } : data,
          ),
        ),
        existing)
      : await itemRepo.create(data);
    if (address && addressChanged && (await previewEnabled()))
      void fetchPreviewFor(saved.id, address);
    onClose();
  }

  return (
    <Form onSubmit={() => void save()}>
      <TextField
        label={t.form.title}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required={!url.trim()}
        data-autofocus
      />
      <TextField
        label={t.bookmarks.url}
        type="text"
        inputMode="url"
        autoComplete="off"
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setError('');
        }}
        error={error}
      />
      <AdvancedFields moduleId="bookmarks" hasData={kind !== 'link' || !!tags || !!note}>
        <SelectField
          label={t.bookmarks.kind}
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind)}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {t.bookmarks.kinds[k]}
            </option>
          ))}
        </SelectField>
        <TextField
          label={t.bookmarks.tags}
          hint={t.bookmarks.tagsHint}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
        <TextArea label={t.form.note} value={note} onChange={(e) => setNote(e.target.value)} />
      </AdvancedFields>
      <FormActions
        start={
          existing ? (
            <Button
              variant="danger"
              onClick={async () => {
                await deleteWithUndo(() => itemRepo.remove(existing.id));
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
