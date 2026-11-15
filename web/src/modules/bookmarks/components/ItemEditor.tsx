import { changedFields } from '@/core/db/patch';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { t } from '@/strings';
import {
  AdvancedFields,
  Button,
  Checkbox,
  Dialog,
  Form,
  FormActions,
  SelectField,
  TextArea,
  TextField,
} from '@/ui';
import { findDuplicate, formatTags, normalizeUrl, parseTags, statusOf } from '../logic';
import { fetchPreviewFor, previewEnabled } from '../preview';
import { itemRepo } from '../repo';
import { KINDS, type BookmarkItem, type Kind } from '../schema';
import { deleteWithUndo } from '@/core/undo/withToast';
import styles from './ItemEditor.module.css';

export type ItemTarget =
  | Stored<BookmarkItem>
  /** `shared`: the draft came through "Teilen"; its preview is fetched once on saving (a tick in the form). */
  | { draft: true; title?: string; url?: string; kind?: Kind; shared?: boolean }
  | null;

export function ItemEditor({
  target,
  onClose,
  onOpenExisting,
}: {
  target: ItemTarget;
  onClose: () => void;
  /** Opens the item the draft duplicates instead of the draft. */
  onOpenExisting?: (item: Stored<BookmarkItem>) => void;
}) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      askAfterTyping
      open={target !== null}
      onClose={onClose}
      title={existing ? t.bookmarks.edit : t.bookmarks.add}
    >
      {target ? (
        <Fields
          key={existing?.id ?? 'new'}
          target={target}
          onClose={onClose}
          onOpenExisting={onOpenExisting}
        />
      ) : null}
    </Dialog>
  );
}

function Fields({
  target,
  onClose,
  onOpenExisting,
}: {
  target: NonNullable<ItemTarget>;
  onClose: () => void;
  onOpenExisting?: (item: Stored<BookmarkItem>) => void;
}) {
  const existing = 'id' in target ? target : null;
  const draft = !existing
    ? (target as { title?: string; url?: string; kind?: Kind; shared?: boolean })
    : {};
  // The record as the editor opened it: only fields that differ from it are saved (QA X01).
  const [opened] = useState(existing);
  const [title, setTitle] = useState(existing?.title ?? draft.title ?? '');
  const [url, setUrl] = useState(existing?.url ?? draft.url ?? '');
  const [kind, setKind] = useState<Kind>(existing?.kind ?? draft.kind ?? 'link');
  const [tags, setTags] = useState(formatTags(existing?.tags ?? []));
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState('');
  // A shared link gets its preview on saving, unless the tick is taken away (the page learns of the fetch).
  const shared = !existing && !!draft.shared && !!draft.url;
  const [withPreview, setWithPreview] = useState(shared);
  // The same page (or, without an address, the same title) already saved: say so, never block.
  const all = useLiveQuery(() => itemRepo.active().toArray(), []);
  const duplicate = all ? findDuplicate(all, { title, url }, existing?.id) : undefined;

  async function save() {
    const address = url.trim() ? normalizeUrl(url) : undefined;
    if (url.trim() && !address) return setError(t.bookmarks.urlInvalid);
    // A text of only spaces passes the field's `required` but not the schema: say so (QA X34).
    if (!title.trim() && !address) return setError(t.form.required);
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
    if (address && addressChanged && ((shared && withPreview) || (await previewEnabled())))
      void fetchPreviewFor(saved.id, address);
    onClose();
  }

  return (
    <Form onSubmit={save}>
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
      {duplicate ? (
        <p className={styles.duplicate} role="status" data-testid="bookmark-duplicate">
          <span>
            {t.bookmarks.duplicate(
              duplicate.title,
              statusOf(duplicate) === 'open' ? '' : t.bookmarks.statuses[statusOf(duplicate)],
            )}
          </span>
          {onOpenExisting ? (
            <Button variant="ghost" onClick={() => onOpenExisting(duplicate)}>
              {t.bookmarks.duplicateOpen}
            </Button>
          ) : null}
        </p>
      ) : null}
      {shared ? (
        <Checkbox
          label={t.bookmarks.sharedPreview}
          description={t.bookmarks.sharedPreviewHint}
          checked={withPreview}
          onChange={(e) => setWithPreview(e.target.checked)}
        />
      ) : null}
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
          {existing ? t.actions.save : t.bookmarks.add}
        </Button>
      </FormActions>
    </Form>
  );
}
