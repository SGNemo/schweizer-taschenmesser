import { useState } from 'react';
import { t } from '@/strings';
import {
  Button,
  Dialog,
  Form,
  FormActions,
  IconButton,
  Icon,
  Switch,
  TextArea,
  TextField,
} from '@/ui';
import type { DecryptedEntry } from '../vault';
import { saveEntry } from '../vault';
import { today } from '@/core/time/dates';
import { parseTotpInput } from '../totp';
import type { EntryDraft } from '../schema';
import styles from '../accounts.module.css';
import { GeneratorPanel } from './GeneratorPanel';
import { StrengthMeter } from './StrengthMeter';

/**
 * `draft.password` pre-fills a new entry (from the generator dialog); `draft.prefill` fills title, user name,
 * password and notes (an entry a tool handed over, see `core/handoff/vaultEntry.ts`). It is only the form's
 * starting values: saving goes through `saveEntry` like any entry.
 */
export interface EntryPrefill {
  title?: string;
  username?: string;
  password?: string;
  notes?: string;
}
export type EntryTarget =
  DecryptedEntry | { draft: true; password?: string; prefill?: EntryPrefill } | null;

export function EntryForm({
  target,
  onClose,
  onSaved,
}: {
  target: EntryTarget;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const existing = target && 'id' in target ? target : null;
  const draft = target && 'draft' in target ? target : undefined;
  const prefill: EntryPrefill | undefined = draft
    ? { ...draft.prefill, password: draft.prefill?.password ?? draft.password }
    : undefined;
  const draftPassword = prefill?.password;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={existing ? t.accounts.edit : t.accounts.add}
    >
      {target ? (
        <Fields
          key={existing?.id ?? `new-${draftPassword ?? ''}-${prefill?.title ?? ''}`}
          existing={existing}
          prefill={prefill}
          onClose={onClose}
          onSaved={onSaved}
        />
      ) : null}
    </Dialog>
  );
}

function Fields({
  existing,
  prefill,
  onClose,
  onSaved,
}: {
  existing: DecryptedEntry | null;
  prefill?: EntryPrefill;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const d = existing?.data;
  const [title, setTitle] = useState(d?.title ?? prefill?.title ?? '');
  const [username, setUsername] = useState(d?.username ?? prefill?.username ?? '');
  const [password, setPassword] = useState(d?.password ?? prefill?.password ?? '');
  const [url, setUrl] = useState(d?.url ?? '');
  const [notes, setNotes] = useState(d?.notes ?? prefill?.notes ?? '');
  const [tags, setTags] = useState((d?.tags ?? []).join(', '));
  const [totp, setTotp] = useState(d?.totp?.secret ?? '');
  const [favorite, setFavorite] = useState(d?.favorite ?? false);
  const [reveal, setReveal] = useState(!existing);
  const [generator, setGenerator] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; totp?: string }>({});

  async function save() {
    const parsedTotp = totp.trim() ? parseTotpInput(totp) : undefined;
    const next: typeof errors = {};
    if (!title.trim()) next.title = t.form.required;
    if (totp.trim() && !parsedTotp) next.totp = t.accounts.fields.totpInvalid;
    setErrors(next);
    if (next.title || next.totp) return;
    const draft: EntryDraft = {
      title: title.trim(),
      username,
      password,
      url: url.trim(),
      notes,
      tags: tags
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
      totp: parsedTotp,
      favorite,
      // The age hint counts from the last time the password itself changed.
      changedAt:
        existing && existing.data.password === password ? existing.data.changedAt : today(),
    };
    const id = await saveEntry(draft, existing?.id);
    onSaved?.(id);
    onClose();
  }

  return (
    <Form onSubmit={() => void save()}>
      <TextField
        label={t.accounts.fields.title}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        error={errors.title}
        data-autofocus
      />
      <TextField
        label={t.accounts.fields.username}
        value={username}
        autoComplete="off"
        onChange={(e) => setUsername(e.target.value)}
      />
      <div className={styles.inline}>
        <TextField
          label={t.accounts.fields.password}
          type={reveal ? 'text' : 'password'}
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <IconButton
          label={reveal ? t.accounts.hide : t.accounts.show}
          onClick={() => setReveal(!reveal)}
        >
          <Icon name={reveal ? 'eyeOff' : 'eye'} size={18} />
        </IconButton>
        <IconButton label={t.accounts.generator.open} onClick={() => setGenerator(!generator)}>
          <Icon name="sparkles" size={18} />
        </IconButton>
      </div>
      <StrengthMeter password={password} userInputs={[title, username]} />
      {generator ? (
        <GeneratorPanel
          onUse={(v) => {
            setPassword(v);
            setReveal(true);
            setGenerator(false);
          }}
        />
      ) : null}
      <TextField
        label={t.accounts.fields.url}
        // Plain text: "service.berlin.de" is a fine address; the browser's own URL check would reject it.
        inputMode="url"
        autoCapitalize="none"
        autoComplete="off"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <TextField
        label={t.accounts.fields.totp}
        hint={t.accounts.fields.totpHint}
        autoComplete="off"
        spellCheck={false}
        value={totp}
        onChange={(e) => setTotp(e.target.value)}
        error={errors.totp}
      />
      <TextField
        label={t.accounts.fields.tags}
        hint={t.accounts.fields.tagsHint}
        value={tags}
        onChange={(e) => setTags(e.target.value)}
      />
      <TextArea
        label={t.accounts.fields.notes}
        rows={4}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <Switch label={t.accounts.fields.favorite} checked={favorite} onChange={setFavorite} />
      <FormActions>
        <Button onClick={onClose}>{t.actions.cancel}</Button>
        <Button type="submit" variant="primary">
          {t.actions.save}
        </Button>
      </FormActions>
    </Form>
  );
}
